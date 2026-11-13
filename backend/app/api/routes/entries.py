import sqlite3
import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends
from backend.app.api.deps import get_db_conn
from backend.app.core.config import settings
from backend.app.core.security import get_authenticated_user_id
from backend.app.models.enums import AnalysisStatus, OffsetEncoding
from backend.app.models.schemas import (
    AnalysisResponse,
    EntryAnalyzeRequest,
    EntryDeleteResponse,
    JournalEntryCreateOrUpdate,
    JournalEntryResponse,
    SuggestionEdit,
    SuggestionExplanation,
    SuggestionResponse,
)
from backend.app.services.ai_service import (
    analyze_journal_text,
    get_active_model_version,
)
from backend.app.services.journal_service import (
    delete_entry,
    get_entry,
    list_entries,
    save_or_update_entry,
)
from backend.app.services.validator import validate_and_filter_suggestions

router = APIRouter(prefix="/entries", tags=["entries"])


@router.get("", response_model=List[JournalEntryResponse])
def get_user_entries(
    include_deleted: bool = False,
    user_id: str = Depends(get_authenticated_user_id),
    conn: sqlite3.Connection = Depends(get_db_conn),
) -> List[JournalEntryResponse]:
    """Lists entries for the current user in reverse chronological order."""
    return list_entries(conn, user_id, include_deleted=include_deleted)


@router.post("", response_model=JournalEntryResponse)
def save_entry(
    payload: JournalEntryCreateOrUpdate,
    user_id: str = Depends(get_authenticated_user_id),
    conn: sqlite3.Connection = Depends(get_db_conn),
) -> JournalEntryResponse:
    """Creates a new journal entry or updates an existing one with revision checking."""
    return save_or_update_entry(conn, user_id, payload)


@router.post("/analyze", response_model=AnalysisResponse)
def analyze_entry(
    payload: EntryAnalyzeRequest,
    user_id: str = Depends(get_authenticated_user_id),
    conn: sqlite3.Connection = Depends(get_db_conn),
) -> AnalysisResponse:
    """
    Submits a journal entry for AI feedback:
    1. Persists or syncs the entry in the database.
    2. Runs AI linguistic analysis (Gemini or offline heuristic).
    3. Validates and filters suggestions (strict UTF-16, taxonomy, overlap).
    4. Records immutable analysis and suggestions.
    5. Returns AnalysisResponse with suggestions.
    """
    entry_dto = JournalEntryCreateOrUpdate(
        id=payload.entry_id,
        title=payload.title,
        targetLanguage=payload.target_language,
        explanationLanguage=payload.explanation_language or "en",
        content=payload.content,
        revision=payload.revision or 1,
        expectedRevision=None,
    )
    saved_entry = save_or_update_entry(conn, user_id, entry_dto)

    raw_suggestions = analyze_journal_text(
        payload.content, payload.target_language, payload.explanation_language or "en"
    )

    validated, _ = validate_and_filter_suggestions(
        payload.content, raw_suggestions
    )

    status = AnalysisStatus.COMPLETED
    error_code = None
    if raw_suggestions and not validated:
        status = AnalysisStatus.FAILED
        error_code = "VALIDATION_ALL_CANDIDATES_REJECTED"

    analysis_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    active_model = get_active_model_version()

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
                saved_entry.id,
                saved_entry.revision,
                payload.content,
                status.value,
                OffsetEncoding.UTF_16.value,
                "1.0.0",
                active_model,
                "v1",
                error_code,
                now,
                now if status == AnalysisStatus.COMPLETED else None,
            ),
        )

        response_suggestions: List[SuggestionResponse] = []
        if status == AnalysisStatus.COMPLETED:
            for s in validated:
                sug_id = str(uuid.uuid4())
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

            conn.execute(
                """
                UPDATE journal_entries
                SET active_analysis_id = ?,
                    active_review_revision = ?
                WHERE id = ?;
                """,
                (analysis_id, saved_entry.revision, saved_entry.id),
            )

        conn.commit()
    except Exception:
        conn.rollback()
        raise

    return AnalysisResponse(
        id=analysis_id,
        entryId=saved_entry.id,
        entryRevision=saved_entry.revision,
        sourceText=payload.content,
        status=status,
        offsetEncoding=OffsetEncoding.UTF_16,
        taxonomyVersion="1.0.0",
        modelVersion=active_model,
        promptVersion="v1",
        errorCode=error_code,
        createdAt=now,
        completedAt=now if status == AnalysisStatus.COMPLETED else None,
        suggestions=response_suggestions,
    )


@router.get("/{entry_id}", response_model=JournalEntryResponse)
def get_single_entry(
    entry_id: str,
    include_deleted: bool = False,
    user_id: str = Depends(get_authenticated_user_id),
    conn: sqlite3.Connection = Depends(get_db_conn),
) -> JournalEntryResponse:
    """Retrieves an entry by its ID with full corrections and mistake history, enforcing ownership."""
    return get_entry(conn, entry_id, user_id, include_deleted=include_deleted, include_history=True)


@router.get("/{entry_id}/history", response_model=JournalEntryResponse)
def get_entry_history(
    entry_id: str,
    user_id: str = Depends(get_authenticated_user_id),
    conn: sqlite3.Connection = Depends(get_db_conn),
) -> JournalEntryResponse:
    """Retrieves the full revision and mistake correction history for a specific entry."""
    return get_entry(conn, entry_id, user_id, include_deleted=False, include_history=True)


@router.delete("/{entry_id}", response_model=EntryDeleteResponse)
def remove_entry(
    entry_id: str,
    user_id: str = Depends(get_authenticated_user_id),
    conn: sqlite3.Connection = Depends(get_db_conn),
) -> EntryDeleteResponse:
    """Soft deletes a journal entry, keeping previous corrections/suggestions intact."""
    return delete_entry(conn, entry_id, user_id)
