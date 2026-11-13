import os
import tempfile
from typing import Generator
import pytest
from fastapi.testclient import TestClient
from backend.app.core.config import settings
from backend.app.core.database import get_db, init_db
from backend.app.main import app


@pytest.fixture
def temp_db() -> Generator[str, None, None]:
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    init_db(db_path)
    old_db = settings.DATABASE_PATH
    settings.DATABASE_PATH = db_path
    try:
        yield db_path
    finally:
        settings.DATABASE_PATH = old_db
        if os.path.exists(db_path):
            os.remove(db_path)


@pytest.fixture
def client(temp_db: str) -> Generator[TestClient, None, None]:
    def _override_get_db():
        with get_db(temp_db) as conn:
            yield conn

    from backend.app.api.deps import get_db_conn
    app.dependency_overrides[get_db_conn] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
