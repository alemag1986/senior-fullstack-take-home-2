from pathlib import Path
import sqlite3
from contextlib import contextmanager
from typing import Generator
from backend.app.core.config import settings
from backend.db.migrate import run_migrations


def init_db(db_path: str = settings.DATABASE_PATH) -> None:
    """Initializes the database by running all pending migrations."""
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    run_migrations(db_path)


@contextmanager
def get_db(db_path: str = settings.DATABASE_PATH) -> Generator[sqlite3.Connection, None, None]:
    """Yields an SQLite connection configured with WAL, busy timeout, and foreign keys."""
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 30000;")
    try:
        yield conn
    finally:
        conn.close()
