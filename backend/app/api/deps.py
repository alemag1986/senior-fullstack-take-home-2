import sqlite3
from typing import Generator
from fastapi import Depends
from backend.app.core.database import get_db
from backend.app.core.security import get_authenticated_user_id


def get_db_conn() -> Generator[sqlite3.Connection, None, None]:
    with get_db() as conn:
        yield conn
