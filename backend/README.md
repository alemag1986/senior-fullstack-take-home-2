# AI Language Journal — Backend API

FastAPI REST API service providing journal persistence, concurrency control, strict UTF-16 suggestion offset validation, review sequence tracking, and suggestion decision processing.

---

## 1. Features & Architecture

- **Entities & Persistence**: SQLite file database (`journal.db`) with WAL mode, foreign keys, migrations, and indexes managing entries, immutable analysis snapshots, suggestions, actions, and idempotency records.
- **Revision & Concurrency Control**: Optimistic concurrency via `JournalEntry.revision`. Manual saves detect stale revisions (returning `409 Conflict`). Content or target language changes increment revision and invalidate ongoing review cursors.
- **Strict UTF-16 Offsets**: Offset indices match JavaScript `String.slice()`. Surrogate pairs (e.g. emoji like `🎉`) are protected from being split. Unambiguous offset errors are safely repaired; ambiguous or conflicting edits are discarded deterministically.
- **Suggestion Decision Engine**: Right-to-left text reconstruction (`startOffset DESC`), active review cursor tracking, idempotency via `requestId`, and terminal action enforcement (accepted/dismissed).
- **Security & Multi-Tenancy**: Pluggable authentication adapter extracting `X-Session-ID` header (fallback to `dev-user-default`). Strict ownership verification on all endpoints.
- **Unified SPA Static Serving**: Automatically detects compiled frontend assets in `frontend/dist` (or `FRONTEND_DIST_DIR`), mounting static `/assets` and routing all client navigation to `index.html` while reserving `/api/*`, `/health`, and `/docs`. Eliminates CORS and port friction in production.
- **Production Containerization**: Multi-stage Dockerfile running Gunicorn with Uvicorn workers, Tini PID 1 supervisor, non-root user, and persistent SQLite storage mounted at `/data`.

---

## 2. Directory Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── deps.py               # Dependency injection (DB, auth)
│   │   └── routes/
│   │       ├── health.py         # GET /health, GET /api/health
│   │       ├── entries.py        # GET/POST /api/entries, GET /api/entries/{id}
│   │       ├── analysis.py       # POST /api/analyses, GET /api/analyses/{id}
│   │       ├── decisions.py      # POST /api/entries/{id}/decisions
│   │       └── insights.py       # GET /api/insights (Stage 2 aggregates)
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
│   │   ├── ai_service.py         # OpenRouter / Gemini LLM analysis provider
│   │   ├── utf16.py              # UTF-16 code units & surrogate boundaries
│   │   ├── validator.py          # Suggestion validation & conflict resolution
│   │   ├── reconstructor.py      # Right-to-left text rebuilder
│   │   ├── journal_service.py    # Entry CRUD & revision concurrency
│   │   └── decision_service.py   # Decision transactions & cursor updates
│   └── main.py                   # FastAPI app entrypoint & SPA static file server
├── db/
│   ├── migrations/
│   │   └── 001_initial_schema.sql # SQLite schema definition
│   └── migrate.py                # Migration runner
├── tests/
│   ├── conftest.py
│   ├── test_ai_providers.py
│   ├── test_analyze_and_insights.py
│   ├── test_decisions_api.py
│   ├── test_entries_api.py
│   ├── test_health_and_spa.py
│   ├── test_reconstructor.py
│   ├── test_security.py
│   ├── test_taxonomy.py
│   ├── test_utf16.py
│   └── test_validator.py
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

#### Mode A: Unified Production Mode (FastAPI Serving React SPA) [Recommended]
In unified mode, FastAPI serves the compiled React frontend SPA directly from `frontend/dist` on port 8000 alongside all `/api/*` endpoints and `/health`.

- **Step 1: Build the frontend static assets**
  ```bash
  # From inside backend/, or build from root:
  npm --prefix ../frontend run build
  # Or: cd ../frontend && npm run build
  ```

- **Step 2: Start the FastAPI backend**
  ```bash
  cd /Users/ale/Projects/applied-computing/backend
  source .venv/bin/activate
  PYTHONPATH=.. uvicorn app.main:app --port 8000
  # Or with production Gunicorn worker:
  # gunicorn -k uvicorn.workers.UvicornWorker backend.app.main:app --bind 0.0.0.0:8000
  ```

- **Step 3: Access the full application**
  - **Full Application UI**: [http://localhost:8000/](http://localhost:8000/) (FastAPI serves both the SPA and the `/api/*` endpoints with zero CORS/port mismatch).
  - **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)
  - **Interactive API Documentation (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)

#### Mode B: Local Development (Vite HMR Hot-Reloading)
For active UI development where Vite hot module replacement is desired:
- **Terminal 1 (Backend API):**
  ```bash
  cd backend && source .venv/bin/activate
  PYTHONPATH=.. uvicorn app.main:app --reload --port 8000
  ```
- **Terminal 2 (Frontend Dev Server):**
  ```bash
  cd ../frontend
  npm run dev
  ```
  *(Frontend dev server runs at `http://localhost:5173` with proxying to port 8000).*

### 3.4. Run Automated Tests
```bash
cd backend && source .venv/bin/activate
PYTHONPATH=.. pytest tests/ -v
```

---

## 4. Docker & Docker Compose Workflow

The project includes a production-ready, multi-stage `Dockerfile` and `docker-compose.yml` for unified single-container execution:

```bash
# From project root:
docker compose up --build
```

### Highlights:
- **Multi-Stage Build**:
  - `frontend-builder`: Builds the React SPA with Node 20.
  - `python-builder`: Pre-compiles Python wheel packages.
  - `runtime`: Python 3.12-slim container with Tini PID 1 supervisor, non-root `app` user, and Gunicorn managing 2 Uvicorn workers (`uvicorn.workers.UvicornWorker`).
- **Single-Port Delivery**: Serves both frontend SPA and backend API routes on `http://localhost:8000/`.
- **Persistent SQLite Storage**: The SQLite database (`/data/journal.db`) is mapped to the host `./data:/data` volume mount.
- **Container Health Check**: Regularly tests `http://localhost:8000/health`.

---

## 5. DigitalOcean App Platform Deployment

Deploying the unified container to DigitalOcean App Platform:

1. **Connect Repository**:
   - In the DigitalOcean Cloud Console, go to **Apps** -> **Create App**.
   - Select your GitHub or GitLab repository and branch.
   - DigitalOcean automatically detects the root `Dockerfile`.
2. **Configure Environment Variables**:
   - `AI_PROVIDER`: `openrouter` (or `gemini`).
   - `OPENROUTER_API_KEY`: Your OpenRouter API key.
   - `GEMINI_API_KEY`: Your Gemini API key (if using Gemini).
   - `DATABASE_PATH`: `/data/journal.db` (pre-configured in Dockerfile).
3. **Add Attached Storage for SQLite Persistence**:
   - Go to **Settings** -> **Components** -> select the service -> **Attached Storage**.
   - Click **Add Storage** and set the mount path to `/data` (e.g., 1 GB or 5 GB).
   - This ensures the SQLite database (`/data/journal.db`) persists across deployments and container rebuilds.
4. **Health Check & HTTP Port**:
   - HTTP Port: `8000`.
   - Healthcheck path: `http://localhost:8000/health` (automatically queried by App Platform).
