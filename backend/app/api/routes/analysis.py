import sqlite3
import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends
from backend.app.api.deps import get_db_conn
from backend.app.core.errors import AppError
from backend.app.core.security import get_authenticated_user_id, verify_entry_ownership
from backend.app.models.enums import (
    AnalysisStatus,
    FeedbackCategory,
    OffsetEncoding,
    SuggestionKind,
)
from backend.app.models.schemas import (
    AnalysisCreateInput,
    AnalysisResponse,
    SuggestionEdit,
    SuggestionExplanation,
    SuggestionResponse,
)
from backend.app.services.journal_service import get_entry_row
from backend.app.services.validator import validate_and_filter_suggestions

router = APIRouter(prefix="/analyses", tags=["analyses"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def row_to_suggestion_response(row: sqlite3.Row) -> SuggestionResponse:
    return SuggestionResponse(
        id=row["id"],
        analysisId=row["analysis_id"],
        category=FeedbackCategory(row["category"]),
        ruleCode=row["rule_code"],
        kind=SuggestionKind(row["kind"]),
        edit=SuggestionEdit(
            start=row["start_offset"],
            end=row["end_offset"],
            original=row["original_text"],
            replacement=row["replacement_text"],
        ),
        explanation=SuggestionExplanation(
            title=row["explanation_title"],
            message=row["explanation_message"],
        ),
    )


@router.post("", response_model=AnalysisResponse)
def create_analysis_snapshot(
    payload: AnalysisCreateInput,
    user_id: str = Depends(get_authenticated_user_id),
    conn: sqlite3.Connection = Depends(get_db_conn),
) -> AnalysisResponse:
    """
    Ingests an analysis snapshot and candidate suggestions:
    - Verifies entry ownership and revision match.
    - Runs strict UTF-16, taxonomy, repair, and conflict validation.
    - Persists immutable analysis and suggestion records atomically.
    - Activates the entry review cursor if completed.
    """
    entry = get_entry_row(conn, payload.entryId)
    if not entry:
        raise AppError(
            code="NOT_FOUND",
            message=f"Journal entry '{payload.entryId}' not found.",
            status_code=404,
        )

    verify_entry_ownership(entry["user_id"], user_id)

    if entry["revision"] != payload.entryRevision:
        raise AppError(
            code="REVISION_CONFLICT",
            message=(
                f"Analysis revision mismatch. Expected {payload.entryRevision} "
                f"but entry is at revision {entry['revision']}."
            ),
            status_code=409,
        )

    analysis_id = payload.id or str(uuid.uuid4())
    now = _now_iso()

    # Suggestion validation
    validated_suggestions, diagnostics = validate_and_filter_suggestions(
        payload.sourceText, payload.suggestions
    )

    status = AnalysisStatus.COMPLETED
    error_code = None

    # If candidates were provided but NONE survived validation -> fail
    if payload.suggestions and not validated_suggestions:
        status = AnalysisStatus.FAILED
        error_code = "VALIDATION_ALL_CANDIDATES_REJECTED"

    conn.execute("BEGIN IMMEDIATE;")
    try:
        conn.execute(
            """
            INSERT INTO analyses (
                id, entry_id, entry_revision, source_text, status,
                offset_encoding, taxonomy_version, model_version, prompt_version,
                error_code, created_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (
                analysis_id,
                payload.entryId,
                payload.entryRevision,
                payload.sourceText,
                status.value,
                OffsetEncoding.UTF_16.value,
                payload.taxonomyVersion or "1.0.0",
                payload.modelVersion or "manual-v1",
                payload.promptVersion or "v1",
                error_code,
                now,
                now if status == AnalysisStatus.COMPLETED else None,
            ),
        )

        response_suggestions: List[SuggestionResponse] = []
        if status == AnalysisStatus.COMPLETED:
            for s in validated_suggestions:
                sug_id = s.id or str(uuid.uuid4())
                conn.execute(
                    """
                    INSERT INTO suggestions (
                        id, analysis_id, category, rule_code, kind,
                        start_offset, end_offset, original_text, replacement_text,
                        explanation_title, explanation_message
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        sug_id,
                        analysis_id,
                        s.category.value,
                        s.rule_code,
                        s.kind.value,
                        s.start_offset,
                        s.end_offset,
                        s.original_text,
                        s.replacement_text,
                        s.explanation_title,
                        s.explanation_message,
                    ),
                )
                response_suggestions.append(
                    SuggestionResponse(
                        id=sug_id,
                        analysisId=analysis_id,
                        category=s.category,
                        ruleCode=s.rule_code,
                        kind=s.kind,
                        edit=SuggestionEdit(
                            start=s.start_offset,
                            end=s.end_offset,
                            original=s.original_text,
                            replacement=s.replacement_text,
                        ),
                        explanation=SuggestionExplanation(
                            title=s.explanation_title,
                            message=s.explanation_message,
                        ),
                    )
                )

            # Update entry review cursor
            conn.execute(
                """
                UPDATE journal_entries
                SET active_analysis_id = ?,
                    active_review_revision = ?
                WHERE id = ?;
                """,
                (analysis_id, payload.entryRevision, payload.entryId),
            )

        conn.commit()
    except Exception:
        conn.rollback()
        raise

    return AnalysisResponse(
        id=analysis_id,
        entryId=payload.entryId,
        entryRevision=payload.entryRevision,
        sourceText=payload.sourceText,
        status=status,
        offsetEncoding=OffsetEncoding.UTF_16,
        taxonomyVersion=payload.taxonomyVersion or "1.0.0",
        modelVersion=payload.modelVersion or "manual-v1",
        promptVersion=payload.promptVersion or "v1",
        errorCode=error_code,
        createdAt=now,
        completedAt=now if status == AnalysisStatus.COMPLETED else None,
        suggestions=response_suggestions,
    )


@router.get("/{analysis_id}", response_model=AnalysisResponse)
def get_analysis(
    analysis_id: str,
    user_id: str = Depends(get_authenticated_user_id),
    conn: sqlite3.Connection = Depends(get_db_conn),
) -> AnalysisResponse:
    """Retrieves an analysis and its suggestions, enforcing entry ownership."""
    cursor = conn.execute(
        "SELECT * FROM analyses WHERE id = ?;", (analysis_id,)
    )
    analysis = cursor.fetchone()
    if not analysis:
        raise AppError(
            code="NOT_FOUND",
            message=f"Analysis '{analysis_id}' not found.",
            status_code=404,
        )

    entry = get_entry_row(conn, analysis["entry_id"])
    if not entry:
        raise AppError(
            code="NOT_FOUND",
            message="Associated entry not found.",
            status_code=404,
        )

    verify_entry_ownership(entry["user_id"], user_id)

    sug_cursor = conn.execute(
        "SELECT * FROM suggestions WHERE analysis_id = ? ORDER BY start_offset ASC;",
        (analysis_id,),
    )
    suggestions = [row_to_suggestion_response(r) for r in sug_cursor.fetchall()]

    return AnalysisResponse(
        id=analysis["id"],
        entryId=analysis["entry_id"],
        entryRevision=analysis["entry_revision"],
        sourceText=analysis["source_text"],
        status=AnalysisStatus(analysis["status"]),
        offsetEncoding=OffsetEncoding(analysis["offset_encoding"]),
        taxonomyVersion=analysis["taxonomy_version"],
        modelVersion=analysis["model_version"],
        promptVersion=analysis["prompt_version"],
        errorCode=analysis["error_code"],
        createdAt=analysis["created_at"],
        completedAt=analysis["completed_at"],
        suggestions=suggestions,
    )
