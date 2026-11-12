#!/usr/bin/env python3
"""Database initialization script for the AI-Assisted Language Journal."""

import os
import sqlite3
import sys
from pathlib import Path

# Paths
DB_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = DB_DIR.parent
DEFAULT_DB_PATH = PROJECT_ROOT / "journal.db"
SCHEMA_PATH = DB_DIR / "schema.sql"


def init_db(db_path: Path = DEFAULT_DB_PATH) -> None:
    """Initialize the SQLite database using schema.sql."""
    if not SCHEMA_PATH.exists():
        print(f"Error: Schema file not found at {SCHEMA_PATH}", file=sys.stderr)
        sys.exit(1)

    print(f"Initializing database at: {db_path}")
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    # Enable foreign keys and execute DDL
    conn = sqlite3.connect(db_path)
    try:
        with conn:
            conn.execute("PRAGMA foreign_keys = ON;")
            conn.executescript(schema_sql)
        print("Database schema successfully applied.")
    finally:
        conn.close()


if __name__ == "__main__":
    target_db = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DB_PATH
    init_db(target_db)
