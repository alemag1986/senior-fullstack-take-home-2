# AI Language Journal — Backend API

FastAPI REST API service providing journal persistence, concurrency control, strict UTF-16 suggestion offset validation, review sequence tracking, and suggestion decision processing.

---

## 1. Features & Architecture

- **Entities & Persistence**: SQLite file database (`journal.db`) with WAL mode, foreign keys, migrations, and indexes managing entries, immutable analysis snapshots, suggestions, actions, and idempotency records.
- **Revision & Concurrency Control**: Optimistic concurrency via `JournalEntry.revision`. Manual saves detect stale revisions (returning `409 Conflict`). Content or target language changes increment revision and invalidate ongoing review cursors.
- **Strict UTF-16 Offsets**: Offset indices match JavaScript `String.slice()`. Surrogate pairs (e.g. emoji like `🎉`) are protected from being split. Unambiguous offset errors are safely repaired; ambiguous or conflicting edits are discarded deterministically.
- **Suggestion Decision Engine**: Right-to-left text reconstruction (`startOffset DESC`), active review cursor tracking, idempotency via `requestId`, and terminal action enforcement (accepted/dismissed).
- **Security & Multi-Tenancy**: Pluggable authentication adapter extracting `X-Session-ID` header (fallback to `dev-user-default`). Strict ownership verification on all endpoints.

---

## 2. Directory Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── deps.py               # Dependency injection (DB, auth)
│   │   └── routes/
│   │       ├── health.py         # GET /api/health
│   │       ├── entries.py        # GET/POST /api/entries, GET /api/entries/{id}
│   │       ├── analysis.py       # POST /api/analyses, GET /api/analyses/{id}
│   │       └── decisions.py      # POST /api/entries/{id}/decisions
│   ├── core/
│   │   ├── config.py             # Settings via pydantic-settings
│   │   ├── database.py           # SQLite connection & transaction helpers
│   │   ├── errors.py             # Error envelope & AppError handlers
│   │   └── security.py           # AuthAdapter & ownership checks
│   ├── models/
│   │   ├── enums.py              # FeedbackCategory, SuggestionKind, ActionType
│   │   ├── taxonomy.py           # Controlled versioned taxonomy registry
│   │   └── schemas.py            # Pydantic v2 schemas
│   ├── services/
│   │   ├── utf16.py              # UTF-16 code units & surrogate boundaries
│   │   ├── validator.py          # Suggestion validation & conflict resolution
│   │   ├── reconstructor.py      # Right-to-left text rebuilder
│   │   ├── journal_service.py    # Entry CRUD & revision concurrency
│   │   └── decision_service.py   # Decision transactions & cursor updates
│   └── main.py                   # FastAPI app entrypoint
├── db/
│   ├── migrations/
│   │   └── 001_initial_schema.sql # SQLite schema definition
│   └── migrate.py                # Migration runner
├── tests/
│   ├── conftest.py
│   ├── test_utf16.py
│   ├── test_taxonomy.py
│   ├── test_validator.py
│   ├── test_reconstructor.py
│   ├── test_entries_api.py
│   ├── test_decisions_api.py
│   └── test_security.py
├── requirements.txt
└── .env.example
```

---

## 3. Getting Started

### 3.1. Virtual Environment & Dependencies
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3.2. Run Database Migrations
Migrations run automatically on app startup, or manually via:
```bash
PYTHONPATH=.. python3 db/migrate.py
```

### 3.3. Run Server
```bash
PYTHONPATH=.. uvicorn app.main:app --reload --port 8000
```
OpenAPI documentation is available at `http://localhost:8000/docs`.

### 3.4. Run Automated Tests
```bash
PYTHONPATH=.. pytest tests/ -v
```
