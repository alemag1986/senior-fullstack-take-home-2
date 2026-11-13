import sqlite3
from fastapi import APIRouter, Depends
from backend.app.api.deps import get_db_conn
from backend.app.core.security import get_authenticated_user_id
from backend.app.models.schemas import DecisionsRequest, DecisionsResponse
from backend.app.services.decision_service import apply_decisions

router = APIRouter(prefix="/entries", tags=["decisions"])


@router.post("/{entry_id}/decisions", response_model=DecisionsResponse)
def submit_decisions(
    entry_id: str,
    payload: DecisionsRequest,
    user_id: str = Depends(get_authenticated_user_id),
    conn: sqlite3.Connection = Depends(get_db_conn),
) -> DecisionsResponse:
    """
    Submits a batch of suggestion decisions for an entry:
    - Atomically locks entry and checks ownership & revision.
    - Idempotency with requestId.
    - Reconstructs text and applies accepted edits right-to-left.
    - Enforces terminal actions and increments entry revision if content changed.
    """
    return apply_decisions(conn, entry_id, user_id, payload)
