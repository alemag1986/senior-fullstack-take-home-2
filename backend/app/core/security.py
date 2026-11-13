from abc import ABC, abstractmethod
from typing import Optional
from fastapi import Header
from backend.app.core.config import settings
from backend.app.core.errors import AppError


class BaseAuthAdapter(ABC):
    @abstractmethod
    def get_current_user_id(self, session_id: Optional[str] = None) -> str:
        """Returns the authenticated user ID from context or session header."""
        pass


class SessionHeaderAuthAdapter(BaseAuthAdapter):
    def get_current_user_id(self, session_id: Optional[str] = None) -> str:
        if session_id and session_id.strip():
            return session_id.strip()
        return settings.DEFAULT_USER_ID


auth_adapter: BaseAuthAdapter = SessionHeaderAuthAdapter()


def get_authenticated_user_id(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
) -> str:
    """FastAPI dependency to retrieve authenticated user ID."""
    return auth_adapter.get_current_user_id(x_session_id)


def verify_entry_ownership(entry_user_id: str, current_user_id: str) -> None:
    """Enforces that the current user owns the target entry."""
    if entry_user_id != current_user_id:
        raise AppError(
            code="UNAUTHORIZED",
            message="You do not have permission to access or modify this entry.",
            status_code=403,
        )
