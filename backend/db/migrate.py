import os
import sqlite3
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def run_migrations(db_path: str) -> None:
    """Runs all SQL migration scripts in order against the SQLite database."""
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")

        conn.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        applied_versions = {
            row[0]
            for row in conn.execute("SELECT version FROM schema_migrations;").fetchall()
        }

        migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
        for file in migration_files:
            version = file.stem
            if version not in applied_versions:
                sql = file.read_text(encoding="utf-8")
                conn.executescript(sql)
                conn.execute(
                    "INSERT INTO schema_migrations (version) VALUES (?);", (version,)
                )
                conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    db_file = os.getenv("DATABASE_PATH", "journal.db")
    run_migrations(db_file)
    print(f"Migrations applied successfully to {db_file}")
