# AI-Assisted Language Journal

Full-stack application for language learners. Write journal entries in target foreign languages, receive granular AI corrections with exact inline text offsets, review and accept/dismiss suggestions interactively, and track learning progress over time.


---

## 1. Local Run Requirements & Setup

### Prerequisites
- **Python**: 3.11+
- **Node.js**: 18+ & npm 9+
- **Database**: SQLite3 (bundled with Python, zero external database setup required)

### First-Time Install

#### 1. Backend
```bash
# From project root:
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
cd ..
```

#### 2. Frontend
```bash
# From project root:
npm --prefix frontend install
# Or: cd frontend && npm install
```

---

## 2. How to Run the Project

### 2.1. Unified Production Mode (FastAPI Serving React SPA) 

In this mode, FastAPI acts as a single-port server serving both the compiled React frontend Single-Page Application (SPA) directly from `frontend/dist` and all backend REST endpoints (`/api/*`, `/health`, and `/docs`) on `http://localhost:8000/`. This eliminates CORS issues and port mismatches entirely.

- **Step 1: Build the frontend static assets**
  ```bash
  # From project root:
  npm --prefix frontend run build
  # Or: cd frontend && npm run build
  ```

- **Step 2: Start the FastAPI backend**
  ```bash
  # From project root:
  source backend/.venv/bin/activate
  uvicorn backend.app.main:app --port 8000
  # Or with production Gunicorn worker:
  # gunicorn -k uvicorn.workers.UvicornWorker backend.app.main:app --bind 0.0.0.0:8000
  ```

- **Step 3: Access the full application**
  - **Web Application & UI**: Navigate to [http://localhost:8000/](http://localhost:8000/) (FastAPI serves both the SPA and the `/api/*` endpoints with zero CORS/port mismatch).
  - **Health Check**: [http://localhost:8000/health](http://localhost:8000/health) (or `http://localhost:8000/api/health`)
  - **Interactive API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 2.2. Local Development (Vite HMR Hot-Reloading)

For active UI development where you want Vite's instant Hot Module Replacement (HMR), run the backend and frontend development servers concurrently in two terminal windows:

Open two terminal windows at `/Users/ale/Projects/applied-computing`:

**Terminal 1 (Backend API):**
```bash
source backend/.venv/bin/activate
uvicorn backend.app.main:app --reload --port 8000
```

**Terminal 2 (Frontend Dev Server with HMR):**
```bash
npm --prefix frontend run dev
# Or: cd frontend && npm run dev
```

*The frontend dev server runs at `http://localhost:5173` and proxies API requests to `http://localhost:8000`. Interactive API documentation is available at `http://localhost:8000/docs`.*

---

### 2.3. Additional Execution Options

#### Backend Execution Options
- **Option 1: From Project Root (Recommended)**
  ```bash
  source backend/.venv/bin/activate
  uvicorn backend.app.main:app --reload --port 8000
  ```
- **Option 2: From Inside `backend/`**
  ```bash
  cd backend
  source .venv/bin/activate
  PYTHONPATH=.. uvicorn backend.app.main:app --reload --port 8000
  ```
  *(Setting `PYTHONPATH=..` includes the parent folder in Python's search path to resolve `backend` as top-level package).*

#### Tip: Work Inside `backend/` Without `PYTHONPATH=..`
Add a `.pth` file to the virtual environment once:
```bash
# Replace python3.x with your venv's python version (e.g. python3.14 or python3.11)
echo "/Users/ale/Projects/applied-computing" > backend/.venv/lib/python3.*/site-packages/project_root.pth
```
After this, Python resolves `backend.*` automatically from any directory with `.venv` active.

#### Frontend Execution Options
- **From Project Root:** `npm --prefix frontend run dev`
- **From Inside `frontend/`:** `cd frontend && npm run dev`

---

## 3. Docker & Docker Compose Workflow

You can build and run the entire unified application (FastAPI + compiled React SPA) inside a production-grade multi-stage container with persistent SQLite storage using a single command:

```bash
docker compose up --build
```

### What This Does:
1. **Multi-Stage Docker Build**:
   - **Stage 1 (`frontend-builder`)**: Compiles the React SPA with Node 20 into static production assets in `dist/`.
   - **Stage 2 (`python-builder`)**: Pre-compiles Python dependencies into isolated wheels.
   - **Stage 3 (`runtime`)**: Minimal Python 3.12 slim runtime with:
     - Tini as PID 1 for signal forwarding and clean zombie reaping.
     - Non-root `app` system user for secure container execution.
     - Production Gunicorn managing 2 Uvicorn workers (`uvicorn.workers.UvicornWorker`).
2. **Unified Single-Port Delivery**: Serves both the compiled React frontend and the `/api/*` endpoints on `http://localhost:8000`.
3. **Persistent SQLite Database**: Mounts `./data:/data` from the host to persist the SQLite database (`/data/journal.db`) across container rebuilds and restarts.
4. **Automated Healthcheck**: Docker continuously queries `http://localhost:8000/health` (HTTP 200 `{"status": "ok"}`).

To run in the background (detached mode):
```bash
docker compose up -d --build
```
To stop the container:
```bash
docker compose down
```

---

## 4. DigitalOcean App Platform Deployment

Deploying the unified container to DigitalOcean App Platform takes only a few minutes using the root `Dockerfile`:

### Step 1: Connect Repository
1. In the [DigitalOcean Cloud Console](https://cloud.digitalocean.com/apps), click **Create App**.
2. Select **GitHub** or **GitLab**, authorize access, and choose the repository and target branch (e.g. `main` or `dev`).
3. App Platform automatically detects the repository's root `Dockerfile`.

### Step 2: Configure Environment Variables
Under **Environment Variables**, configure your AI provider and credentials:
- `AI_PROVIDER`: `openrouter` (default) or `gemini`
- `OPENROUTER_API_KEY`: Your OpenRouter API key (if using OpenRouter)
- `GEMINI_API_KEY`: Your Google Gemini API key (if using Gemini)
- `DATABASE_PATH`: Set to `/data/journal.db` (already default in container)

### Step 3: Attach Persistent Storage (Critical for SQLite)
Because App Platform containers run on an ephemeral filesystem, attach persistent block storage so your SQLite database persists across redeploys:
1. Navigate to **Settings** -> **Components** -> Select your web service component.
2. Scroll to **Attached Storage** and click **Add Storage**.
3. Set the **Mount Path** to `/data`.
4. Select storage capacity (e.g. 1 GB or 5 GB).
5. Save changes.

### Step 4: Health Check & HTTP Port Configuration
- **HTTP Port**: Set to `8000` (auto-detected from `EXPOSE 8000` in the Dockerfile).
- **Healthcheck Path**: The container exposes `/health` at the root. DigitalOcean App Platform automatically checks `http://localhost:8000/health` and marks the deployment healthy when it receives HTTP 200.

### Step 5: Deploy & Verify
Click **Review and Deploy**. Once the build finishes:
- Your application is live at `https://<your-app-name>.ondigitalocean.app/`.
- Both the React frontend SPA and all `/api/*` routes are served securely over HTTPS from the same domain with zero CORS setup required.

---

## 5. Running Automated Tests

### Backend Tests
- **From project root:**
  ```bash
  backend/.venv/bin/python -m pytest backend/tests/ -v
  ```
- **From inside `backend/`:**
  ```bash
  cd backend
  source .venv/bin/activate
  PYTHONPATH=.. pytest tests/ -v
  ```

### Frontend Tests
- **From project root:**
  ```bash
  npm --prefix frontend test
  npm --prefix frontend run test:watch
  ```
- **From inside `frontend/`:**
  ```bash
  cd frontend
  npm test
  npm run test:watch
  ```

### Frontend Build
- **From project root:** `npm --prefix frontend run build`
- **From inside `frontend/`:** `cd frontend && npm run build`

---

## 6. Tool Description & Features

### Description
AI-Assisted Language Journal is an intelligent writing assistant designed for foreign language acquisition. It captures student writing, passes text through an LLM analysis pipeline using controlled linguistic taxonomies, and generates structured inline feedback.

### Key Features
- **Multi-Language Journaling**: Write entries in Spanish, French, German, Italian, and other target languages with customizable explanation language.
- **Granular Inline Suggestions**: Suggestions include category (grammar, vocabulary, spelling, style), rule code, original text, replacement, and explanations.
- **Safe UTF-16 Offset Alignment**: Offsets match JavaScript `String.slice()` indices and preserve Unicode surrogate pairs (e.g. emoji and accented glyphs).
- **Interactive Review Flow**: Review suggestions individually. Accepting a suggestion applies right-to-left text reconstruction to avoid index drift; dismissing retains original text.
- **Optimistic Concurrency Control**: Entries maintain incrementing `revision` counters. Out-of-date updates yield `409 Conflict` to prevent overwriting edits.
- [TODO] **Stage 2 Learning Insights**: Aggregates mistake frequency, category breakdowns, common error rules, and writing activity trends over time.
- **Session Isolation**: Supports multi-tenant user scoping via `X-Session-ID` header (defaults to `dev-user-default`).
- **Unified Single-Port Delivery**: FastAPI serves the React SPA static build, handling client routing alongside `/api/*` endpoints and `/health` with zero CORS hurdles.
- **Production Containerization**: Multi-stage Dockerfile with Tini supervisor, non-root user, Gunicorn workers, and persistent SQLite storage.

---

## 7. Command Quick Reference

### Full-Stack & Deployment Commands
| Task | Command |
| :--- | :--- |
| **Build Frontend Static Assets** | `npm --prefix frontend run build` |
| **Run Unified Mode (FastAPI + SPA)** | `source backend/.venv/bin/activate && uvicorn backend.app.main:app --port 8000` |
| **Run Production Container** | `docker compose up --build` |
| **Run Detached Container** | `docker compose up -d --build` |
| **Stop Container** | `docker compose down` |

### Backend Commands (Inside `backend/`)
| Task | Command |
| :--- | :--- |
| **Start Dev Server (Reload)** | `source .venv/bin/activate && PYTHONPATH=.. uvicorn app.main:app --reload --port 8000` |
| **Run Migrations** | `PYTHONPATH=.. python3 db/migrate.py` |
| **Run All Tests** | `PYTHONPATH=.. pytest tests/ -v` |
| **Health Check Endpoint** | Navigate to `http://localhost:8000/health` |
| **API Docs (Swagger)** | Navigate to `http://localhost:8000/docs` while server runs |

### Frontend Commands (Inside `frontend/`)
| Task | Command |
| :--- | :--- |
| **Start Dev Server (Vite HMR)** | `npm run dev` (Runs on `http://localhost:5173`) |
| **Build for Production** | `npm run build` |
| **Run Unit Tests** | `npm test` |
| **Run Tests (Watch)** | `npm run test:watch` |
| **Preview Build** | `npm run preview` |

---

## 8. Architecture & Model Design

### System Architecture
The application uses a decoupled yet unified 3-tier architecture:
- **Client (Frontend)**: React 18 SPA built with TypeScript, Vite, Tailwind CSS, and Lucide icons.
- **API & Analysis (Backend)**: FastAPI running on Python 3.11+. In unified production mode, FastAPI serves static assets and handles SPA client-side fallback routes from `frontend/dist`, while managing business logic, concurrency control, UTF-16 validation, and AI analysis pipelines.
- **Persistence (Database)**: SQLite file (`journal.db` or `/data/journal.db`) with Write-Ahead Logging (`WAL`), strict foreign keys, and indexes.
- **Container Infrastructure**: Multi-stage Docker image featuring Tini PID 1 supervisor, non-root execution, Gunicorn process manager with Uvicorn workers, and persistent volume support.

```
┌────────────────────────────────────────────────────────┐
│                   React 18 SPA Client                  │
│       (Editor, Inline Diff Viewer, Insights Chart)     │
└───────────────────────────┬────────────────────────────┘
                            │ Single-Port HTTP / REST
                            ▼
┌────────────────────────────────────────────────────────┐
│                  FastAPI Backend Server                │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │ Static SPA & Assets  │    │     AI Service       │  │
│  │ (frontend/dist)      │    │ (OpenRouter / Gemini)│  │
│  └──────────┬───────────┘    └──────────┬───────────┘  │
│             │                           │              │
│  ┌──────────▼───────────┐    ┌──────────▼───────────┐  │
│  │ Revision Concurrency │    │  Taxonomy Validator  │  │
│  └──────────┬───────────┘    └──────────┬───────────┘  │
│             │                           │              │
│  ┌──────────▼───────────┐    ┌──────────▼───────────┐  │
│  │ UTF-16 Text Builder  │    │  Health & Endpoints  │  │
│  └──────────────────────┘    └──────────────────────┘  │
└───────────────────────────┬────────────────────────────┘
                            │ SQLite Driver (WAL Mode)
                            ▼
┌────────────────────────────────────────────────────────┐
│              journal.db  (/data/journal.db)            │
│  (journal_entries, analyses, suggestions, actions,...) │
└────────────────────────────────────────────────────────┘
```

### Data Model Design
```
journal_entries
  ├── id (UUID PK)
  ├── user_id (TEXT, indexed)
  ├── title (TEXT)
  ├── target_language (TEXT)
  ├── explanation_language (TEXT)
  ├── content (TEXT)
  ├── revision (INTEGER) ─────────────► Optimistic Locking
  ├── active_analysis_id (FK -> analyses.id)
  └── active_review_revision (INTEGER)

analyses (Immutable Snapshot)
  ├── id (UUID PK)
  ├── entry_id (FK -> journal_entries.id)
  ├── entry_revision (INTEGER)
  ├── source_text (TEXT)
  ├── status ('pending' | 'running' | 'completed' | 'failed')
  ├── offset_encoding ('utf-16')
  ├── taxonomy_version (TEXT)
  └── model_version (TEXT)

suggestions (Linguistic Feedback)
  ├── id (UUID PK)
  ├── analysis_id (FK -> analyses.id)
  ├── category ('grammar' | 'vocabulary' | 'spelling' | 'style')
  ├── rule_code (TEXT)
  ├── kind ('replacement' | 'insertion' | 'deletion')
  ├── start_offset (INTEGER UTF-16)
  ├── end_offset (INTEGER UTF-16)
  ├── original_text (TEXT)
  ├── replacement_text (TEXT)
  ├── explanation_title (TEXT)
  └── explanation_message (TEXT)

suggestion_actions (Terminal Decisions)
  ├── id (UUID PK)
  ├── suggestion_id (FK -> suggestions.id UNIQUE)
  ├── action ('accepted' | 'dismissed')
  ├── resulting_entry_revision (INTEGER)
  └── created_at (TIMESTAMP)

idempotent_requests (Replay Guard)
  ├── request_id (TEXT PK)
  ├── response_payload (TEXT)
  ├── status_code (INTEGER)
  └── created_at (TIMESTAMP)
```

### Text Reconstruction & Offset Invariant
When accepting suggestions:
1. Engine sorts accepted edits by `start_offset DESC` (right-to-left).
2. Slices original text and splices replacements from back to front.
3. Earlier text offsets remain stable; zero offset-drift across multi-suggestion reviews.
