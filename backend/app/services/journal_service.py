import sqlite3
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from backend.app.core.config import settings
from backend.app.core.errors import AppError
from backend.app.core.security import verify_entry_ownership
from backend.app.models.enums import (
    AnalysisStatus,
    FeedbackCategory,
    OffsetEncoding,
    SuggestionKind,
)
from backend.app.models.schemas import (
    AnalysisResponse,
    EntryDeleteResponse,
    JournalEntryCreateOrUpdate,
    JournalEntryResponse,
    SuggestionEdit,
    SuggestionExplanation,
    SuggestionResponse,
)
from backend.app.services.utf16 import utf16_len


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def row_to_entry_response(
    row: sqlite3.Row,
    analyses: Optional[List[AnalysisResponse]] = None,
    mistakes_history: Optional[List[SuggestionResponse]] = None,
) -> JournalEntryResponse:
    keys = row.keys()
    deleted_at = row["deleted_at"] if "deleted_at" in keys else None
    active_analysis_id = row["active_analysis_id"] if "active_analysis_id" in keys else None
    active_review_revision = row["active_review_revision"] if "active_review_revision" in keys else None
    return JournalEntryResponse(
        id=row["id"],
        userId=row["user_id"],
        title=row["title"],
        targetLanguage=row["target_language"],
        explanationLanguage=row["explanation_language"],
        content=row["content"],
        revision=row["revision"],
        createdAt=row["created_at"],
        updatedAt=row["updated_at"],
        deletedAt=deleted_at,
        activeAnalysisId=active_analysis_id,
        activeReviewRevision=active_review_revision,
        analyses=analyses or [],
        mistakesHistory=mistakes_history or [],
    )


def get_entry_analyses_and_mistakes(
    conn: sqlite3.Connection, entry_id: str
) -> tuple[List[AnalysisResponse], List[SuggestionResponse]]:
    ana_cursor = conn.execute(
        "SELECT * FROM analyses WHERE entry_id = ? ORDER BY created_at DESC;",
        (entry_id,),
    )
    analyses_rows = ana_cursor.fetchall()
    analyses: List[AnalysisResponse] = []
    mistakes_history: List[SuggestionResponse] = []

    for a_row in analyses_rows:
        analysis_id = a_row["id"]
        sug_cursor = conn.execute(
            """
            SELECT s.*, sa.action, sa.created_at as action_created_at
            FROM suggestions s
            LEFT JOIN suggestion_actions sa ON s.id = sa.suggestion_id
            WHERE s.analysis_id = ?
            ORDER BY s.start_offset ASC;
            """,
            (analysis_id,),
        )
        sug_rows = sug_cursor.fetchall()
        suggestions: List[SuggestionResponse] = []
        for s in sug_rows:
            action = s["action"] if "action" in s.keys() and s["action"] else "pending"
            action_created_at = s["action_created_at"] if "action_created_at" in s.keys() else None
            sug_dto = SuggestionResponse(
                id=s["id"],
                analysisId=s["analysis_id"],
                category=FeedbackCategory(s["category"]),
                ruleCode=s["rule_code"],
                kind=SuggestionKind(s["kind"]),
                edit=SuggestionEdit(
                    start=s["start_offset"],
                    end=s["end_offset"],
                    original=s["original_text"],
                    replacement=s["replacement_text"],
                ),
                explanation=SuggestionExplanation(
                    title=s["explanation_title"],
                    message=s["explanation_message"],
                ),
                state=action,
                actionCreatedAt=action_created_at,
            )
            suggestions.append(sug_dto)
            mistakes_history.append(sug_dto)

        analyses.append(
            AnalysisResponse(
                id=a_row["id"],
                entryId=a_row["entry_id"],
                entryRevision=a_row["entry_revision"],
                sourceText=a_row["source_text"],
                status=AnalysisStatus(a_row["status"]),
                offsetEncoding=OffsetEncoding(a_row["offset_encoding"]),
                taxonomyVersion=a_row["taxonomy_version"],
                modelVersion=a_row["model_version"],
                promptVersion=a_row["prompt_version"],
                errorCode=a_row["error_code"],
                createdAt=a_row["created_at"],
                completedAt=a_row["completed_at"],
                suggestions=suggestions,
            )
        )
    return analyses, mistakes_history


def get_entry_row(conn: sqlite3.Connection, entry_id: str) -> Optional[sqlite3.Row]:
    cursor = conn.execute(
        "SELECT * FROM journal_entries WHERE id = ?;", (entry_id,)
    )
    return cursor.fetchone()


def get_entry(
    conn: sqlite3.Connection,
    entry_id: str,
    user_id: str,
    include_deleted: bool = False,
    include_history: bool = True,
) -> JournalEntryResponse:
    row = get_entry_row(conn, entry_id)
    if not row:
        raise AppError(
            code="NOT_FOUND",
            message=f"Journal entry '{entry_id}' not found.",
            status_code=404,
        )
    verify_entry_ownership(row["user_id"], user_id)
    if not include_deleted and "deleted_at" in row.keys() and row["deleted_at"] is not None:
        raise AppError(
            code="NOT_FOUND",
            message=f"Journal entry '{entry_id}' not found.",
            status_code=404,
        )

    if include_history:
        analyses, mistakes_history = get_entry_analyses_and_mistakes(conn, entry_id)
        return row_to_entry_response(row, analyses=analyses, mistakes_history=mistakes_history)

    return row_to_entry_response(row)


def list_entries(
    conn: sqlite3.Connection,
    user_id: str,
    include_deleted: bool = False,
) -> List[JournalEntryResponse]:
    if include_deleted:
        cursor = conn.execute(
            "SELECT * FROM journal_entries WHERE user_id = ? ORDER BY updated_at DESC;",
            (user_id,),
        )
    else:
        cursor = conn.execute(
            "SELECT * FROM journal_entries WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC;",
            (user_id,),
        )
    return [row_to_entry_response(r) for r in cursor.fetchall()]


def delete_entry(
    conn: sqlite3.Connection,
    entry_id: str,
    user_id: str,
) -> EntryDeleteResponse:
    existing = get_entry_row(conn, entry_id)
    if not existing:
        raise AppError(
            code="NOT_FOUND",
            message=f"Journal entry '{entry_id}' not found.",
            status_code=404,
        )
    verify_entry_ownership(existing["user_id"], user_id)
    if "deleted_at" in existing.keys() and existing["deleted_at"] is not None:
        raise AppError(
            code="NOT_FOUND",
            message=f"Journal entry '{entry_id}' is already removed.",
            status_code=404,
        )

    now = _now_iso()
    conn.execute(
        "UPDATE journal_entries SET deleted_at = ?, updated_at = ? WHERE id = ?;",
        (now, now, entry_id),
    )
    conn.commit()
    return EntryDeleteResponse(success=True, id=entry_id, deletedAt=now)


def save_or_update_entry(
    conn: sqlite3.Connection,
    user_id: str,
    data: JournalEntryCreateOrUpdate,
) -> JournalEntryResponse:
    # Validate content length
    content_len = utf16_len(data.content)
    if content_len > settings.MAX_ENTRY_CONTENT_LENGTH:
        raise AppError(
            code="CONTENT_TOO_LONG",
            message=f"Content exceeds maximum allowed length of {settings.MAX_ENTRY_CONTENT_LENGTH} UTF-16 units.",
            status_code=400,
        )

    entry_id = data.id or str(uuid.uuid4())
    existing = get_entry_row(conn, entry_id)
    now = _now_iso()

    if existing:
        verify_entry_ownership(existing["user_id"], user_id)

        if "deleted_at" in existing.keys() and existing["deleted_at"] is not None:
            raise AppError(
                code="ENTRY_DELETED",
                message=f"Journal entry '{entry_id}' has been removed.",
                status_code=400,
            )

        # Revision concurrency check for manual saves
        expected_rev = (
            data.expectedRevision
            if data.expectedRevision is not None
            else data.revision
        )

        if expected_rev is not None and expected_rev != existing["revision"]:
            raise AppError(
                code="REVISION_CONFLICT",
                message=(
                    f"Entry revision mismatch. Expected {expected_rev} but "
                    f"found {existing['revision']}."
                ),
                status_code=409,
                details={
                    "current_revision": existing["revision"],
                    "expected_revision": expected_rev,
                },
            )

        content_changed = existing["content"] != data.content
        lang_changed = existing["target_language"] != data.targetLanguage

        new_revision = existing["revision"]
        active_analysis_id = existing["active_analysis_id"]
        active_review_revision = existing["active_review_revision"]

        # Any content or target language change invalidates ongoing review sequence
        if content_changed or lang_changed:
            new_revision += 1
            active_analysis_id = None
            active_review_revision = None

        conn.execute(
            """
            UPDATE journal_entries
            SET title = ?,
                target_language = ?,
                explanation_language = ?,
                content = ?,
                revision = ?,
                active_analysis_id = ?,
                active_review_revision = ?,
                updated_at = ?
            WHERE id = ?;
            """,
            (
                data.title or existing["title"],
                data.targetLanguage,
                data.explanationLanguage or existing["explanation_language"],
                data.content,
                new_revision,
                active_analysis_id,
                active_review_revision,
                now,
                entry_id,
            ),
        )
        conn.commit()
    else:
        conn.execute(
            """
            INSERT INTO journal_entries (
                id, user_id, title, target_language, explanation_language,
                content, revision, active_analysis_id, active_review_revision,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (
                entry_id,
                user_id,
                data.title or "Journal Entry",
                data.targetLanguage,
                data.explanationLanguage or "en",
                data.content,
                1,
                None,
                None,
                now,
                now,
            ),
        )
        conn.commit()

    updated_row = get_entry_row(conn, entry_id)
    assert updated_row is not None
    return row_to_entry_response(updated_row)
