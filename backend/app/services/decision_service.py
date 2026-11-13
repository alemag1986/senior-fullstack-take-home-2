import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Dict, List
from backend.app.core.errors import AppError
from backend.app.core.security import verify_entry_ownership
from backend.app.models.enums import ActionType
from backend.app.models.schemas import (
    ActionRecord,
    DecisionsRequest,
    DecisionsResponse,
    JournalEntryResponse,
)
from backend.app.services.reconstructor import apply_suggestions_right_to_left


class SuggestionRowItem:
    def __init__(
        self,
        id: str,
        start_offset: int,
        end_offset: int,
        original_text: str,
        replacement_text: str,
    ):
        self.id = id
        self.start_offset = start_offset
        self.end_offset = end_offset
        self.original_text = original_text
        self.replacement_text = replacement_text


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def apply_decisions(
    conn: sqlite3.Connection,
    entry_id: str,
    user_id: str,
    payload: DecisionsRequest,
) -> DecisionsResponse:
    """
    Applies suggestion decisions under an immediate write transaction with:
    - Idempotency check via requestId
    - Entry lock and ownership verification
    - Concurrency and review sequence validation
    - Right-to-left text reconstruction
    - Revision bump if content changes
    """
    # 1. Idempotency Check
    cursor = conn.execute(
        "SELECT response_payload FROM idempotent_requests WHERE request_id = ? AND entry_id = ?;",
        (payload.requestId, entry_id),
    )
    cached = cursor.fetchone()
    if cached:
        data = json.loads(cached["response_payload"])
        return DecisionsResponse.model_validate(data)

    if not payload.decisions:
        raise AppError(
            code="EMPTY_DECISIONS",
            message="Decisions list cannot be empty.",
            status_code=400,
        )

    # 2. Lock entry & verify ownership & revision
    cursor = conn.execute(
        "SELECT * FROM journal_entries WHERE id = ?;", (entry_id,)
    )
    entry = cursor.fetchone()
    if not entry:
        raise AppError(
            code="NOT_FOUND",
            message=f"Journal entry '{entry_id}' not found.",
            status_code=404,
        )

    verify_entry_ownership(entry["user_id"], user_id)

    if entry["revision"] != payload.expectedRevision:
        raise AppError(
            code="REVISION_CONFLICT",
            message=(
                f"Entry revision mismatch. Expected {payload.expectedRevision} but "
                f"found {entry['revision']}."
            ),
            status_code=409,
            details={
                "current_revision": entry["revision"],
                "expected_revision": payload.expectedRevision,
            },
        )

    # 3. Load suggestions in decision payload
    suggestion_ids = [d.suggestionId for d in payload.decisions]
    placeholders = ",".join("?" for _ in suggestion_ids)
    cursor = conn.execute(
        f"SELECT * FROM suggestions WHERE id IN ({placeholders});",
        tuple(suggestion_ids),
    )
    target_suggestions = {row["id"]: row for row in cursor.fetchall()}

    if len(target_suggestions) != len(set(suggestion_ids)):
        missing = set(suggestion_ids) - set(target_suggestions.keys())
        raise AppError(
            code="SUGGESTION_NOT_FOUND",
            message=f"Suggestions not found: {sorted(missing)}",
            status_code=404,
        )

    # All decisions in this batch must belong to the same analysis
    analysis_ids = {s["analysis_id"] for s in target_suggestions.values()}
    if len(analysis_ids) > 1:
        raise AppError(
            code="INVALID_ANALYSIS_BATCH",
            message="All decisions in a request must target the same analysis.",
            status_code=400,
        )
    target_analysis_id = analysis_ids.pop()

    # 4. Verify Analysis completion
    cursor = conn.execute(
        "SELECT * FROM analyses WHERE id = ?;", (target_analysis_id,)
    )
    analysis = cursor.fetchone()
    if not analysis:
        raise AppError(
            code="ANALYSIS_NOT_FOUND",
            message=f"Analysis '{target_analysis_id}' not found.",
            status_code=404,
        )
    if analysis["entry_id"] != entry_id:
        raise AppError(
            code="ANALYSIS_MISMATCH",
            message="Analysis does not belong to the target entry.",
            status_code=400,
        )
    if analysis["status"] != "completed":
        raise AppError(
            code="ANALYSIS_NOT_COMPLETED",
            message=f"Analysis is not completed (current status: {analysis['status']}).",
            status_code=400,
        )

    # 5. Review Sequence & Cursor Verification
    if (
        entry["active_analysis_id"] != target_analysis_id
        or entry["active_review_revision"] != entry["revision"]
    ):
        raise AppError(
            code="REVIEW_SEQUENCE_INVALIDATED",
            message=(
                "The active review sequence has been invalidated by a manual edit, "
                "language change, or newer analysis."
            ),
            status_code=409,
        )

    # 6. Load all previously resolved actions for this analysis
    cursor = conn.execute(
        """
        SELECT a.id, a.suggestion_id, a.action, a.resulting_entry_revision, a.created_at,
               s.start_offset, s.end_offset, s.original_text, s.replacement_text
        FROM suggestion_actions a
        JOIN suggestions s ON a.suggestion_id = s.id
        WHERE s.analysis_id = ?;
        """,
        (target_analysis_id,),
    )
    prior_actions_rows = cursor.fetchall()
    resolved_actions: Dict[str, sqlite3.Row] = {
        row["suggestion_id"]: row for row in prior_actions_rows
    }

    # Verify previous actions against sourceText to reconstruct expected current text
    prior_accepted_suggestions: List[SuggestionRowItem] = [
        SuggestionRowItem(
            id=r["suggestion_id"],
            start_offset=r["start_offset"],
            end_offset=r["end_offset"],
            original_text=r["original_text"],
            replacement_text=r["replacement_text"],
        )
        for r in prior_actions_rows
        if r["action"] == ActionType.ACCEPTED.value
    ]

    expected_current_text = apply_suggestions_right_to_left(
        analysis["source_text"], prior_accepted_suggestions
    )
    if expected_current_text != entry["content"]:
        raise AppError(
            code="TEXT_MISMATCH",
            message="Current entry text does not match expected review state. Manual edits may have occurred.",
            status_code=409,
        )

    # 7. Check for contradictory decisions or duplicate entries in payload
    seen_in_payload = set()
    newly_accepted_suggestions: List[SuggestionRowItem] = []
    actions_to_record: List[ActionRecord] = []
    new_actions_to_insert: List[tuple] = []
    now = _now_iso()

    for d in payload.decisions:
        if d.suggestionId in seen_in_payload:
            raise AppError(
                code="DUPLICATE_DECISION",
                message=f"Duplicate decision for suggestion '{d.suggestionId}' in payload.",
                status_code=400,
            )
        seen_in_payload.add(d.suggestionId)

        if d.suggestionId in resolved_actions:
            prior_action = resolved_actions[d.suggestionId]["action"]
            if prior_action != d.action.value:
                raise AppError(
                    code="CONTRADICTORY_ACTION",
                    message=(
                        f"Suggestion '{d.suggestionId}' is already resolved as "
                        f"'{prior_action}', cannot set to '{d.action.value}'."
                    ),
                    status_code=409,
                )
            # Already resolved identically, include prior action record in response
            actions_to_record.append(
                ActionRecord(
                    id=resolved_actions[d.suggestionId]["id"],
                    suggestionId=d.suggestionId,
                    action=ActionType(prior_action),
                    resultingEntryRevision=resolved_actions[d.suggestionId][
                        "resulting_entry_revision"
                    ],
                    createdAt=resolved_actions[d.suggestionId]["created_at"],
                )
            )
        else:
            action_id = str(uuid.uuid4())
            s_row = target_suggestions[d.suggestionId]
            if d.action == ActionType.ACCEPTED:
                newly_accepted_suggestions.append(
                    SuggestionRowItem(
                        id=d.suggestionId,
                        start_offset=s_row["start_offset"],
                        end_offset=s_row["end_offset"],
                        original_text=s_row["original_text"],
                        replacement_text=s_row["replacement_text"],
                    )
                )

            new_actions_to_insert.append((action_id, d.suggestionId, d.action))

    # 8. Rebuild text from source snapshot using all accepted suggestions
    all_accepted = prior_accepted_suggestions + newly_accepted_suggestions
    final_text = apply_suggestions_right_to_left(
        analysis["source_text"], all_accepted
    )

    actual_content_changed = final_text != entry["content"]
    final_revision = entry["revision"] + (1 if actual_content_changed else 0)

    # Record and insert new actions with final_revision
    for action_id, sug_id, act_type in new_actions_to_insert:
        actions_to_record.append(
            ActionRecord(
                id=action_id,
                suggestionId=sug_id,
                action=act_type,
                resultingEntryRevision=final_revision,
                createdAt=now,
            )
        )
        conn.execute(
            """
            INSERT INTO suggestion_actions (
                id, suggestion_id, action, resulting_entry_revision, created_at
            ) VALUES (?, ?, ?, ?, ?);
            """,
            (
                action_id,
                sug_id,
                act_type.value,
                final_revision,
                now,
            ),
        )

    # 9. Update entry
    conn.execute(
        """
        UPDATE journal_entries
        SET content = ?,
            revision = ?,
            active_review_revision = ?,
            updated_at = ?
        WHERE id = ?;
        """,
        (
            final_text,
            final_revision,
            final_revision,
            now,
            entry_id,
        ),
    )

    # 10. Formulate canonical response & store idempotency record
    updated_entry_row = conn.execute(
        "SELECT * FROM journal_entries WHERE id = ?;", (entry_id,)
    ).fetchone()
    assert updated_entry_row is not None

    entry_response = JournalEntryResponse(
        id=updated_entry_row["id"],
        userId=updated_entry_row["user_id"],
        title=updated_entry_row["title"],
        targetLanguage=updated_entry_row["target_language"],
        explanationLanguage=updated_entry_row["explanation_language"],
        content=updated_entry_row["content"],
        revision=updated_entry_row["revision"],
        createdAt=updated_entry_row["created_at"],
        updatedAt=updated_entry_row["updated_at"],
    )

    response = DecisionsResponse(
        entry=entry_response,
        actions=actions_to_record,
    )

    conn.execute(
        """
        INSERT INTO idempotent_requests (request_id, entry_id, response_payload, created_at)
        VALUES (?, ?, ?, ?);
        """,
        (payload.requestId, entry_id, response.model_dump_json(), now),
    )
    conn.commit()

    return response
