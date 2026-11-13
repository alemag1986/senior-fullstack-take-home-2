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
*Note: Set `GEMINI_API_KEY` in `backend/.env` (optional; mock AI mode activates if omitted).*
*Database migrations run automatically on API startup. To run manually: `PYTHONPATH=. python3 db/migrate.py` from root or `PYTHONPATH=.. python3 db/migrate.py` inside `backend/`.*

#### 2. Frontend
```bash
# From project root:
npm --prefix frontend install
# Or: cd frontend && npm install
```

---

## 2. How to Run the Project

### Running Both Together from Project Root

Open two terminal windows at `/Users/ale/Projects/applied-computing`:

**Terminal 1 (Backend):**
```bash
source backend/.venv/bin/activate
uvicorn backend.app.main:app --reload --port 8000
```

**Terminal 2 (Frontend):**
```bash
npm --prefix frontend run dev
```
*Frontend dev server starts at `http://localhost:5173`. Swagger docs at `http://localhost:8000/docs`.*

---

### Backend Execution Options

#### Option 1: Run from Project Root (Recommended)
```bash
source backend/.venv/bin/activate
uvicorn backend.app.main:app --reload --port 8000
```

#### Option 2: Run from Inside `backend/`
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

---

### Frontend Execution Options

#### Option 1: Run from Project Root (Recommended)
```bash
npm --prefix frontend run dev
```

#### Option 2: Run from Inside `frontend/`
```bash
cd frontend
npm run dev
```

---

## 3. Running Automated Tests

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

## 4. Tool Description & Features

### Description
AI-Assisted Language Journal is an intelligent writing assistant designed for foreign language acquisition. It captures student writing, passes text through an LLM analysis pipeline using controlled linguistic taxonomies, and generates structured inline feedback.

### Key Features
- **Multi-Language Journaling**: Write entries in Spanish, French, German, Italian, and other target languages with customizable explanation language.
- **Granular Inline Suggestions**: Suggestions include category (grammar, vocabulary, spelling, style), rule code, original text, replacement, and explanations.
- **Safe UTF-16 Offset Alignment**: Offsets match JavaScript `String.slice()` indices and preserve Unicode surrogate pairs (e.g. emoji and accented glyphs).
- **Interactive Review Flow**: Review suggestions individually. Accepting a suggestion applies right-to-left text reconstruction to avoid index drift; dismissing retains original text.
- **Optimistic Concurrency Control**: Entries maintain incrementing `revision` counters. Out-of-date updates yield `409 Conflict` to prevent overwriting edits.
- **Stage 2 Learning Insights**: Aggregates mistake frequency, category breakdowns, common error rules, and writing activity trends over time.
- **Session Isolation**: Supports multi-tenant user scoping via `X-Session-ID` header (defaults to `dev-user-default`).

---

## 5. Command Quick Reference

### Backend Commands (Inside `backend/`)
| Task | Command |
| :--- | :--- |
| **Start Server** | `source .venv/bin/activate && PYTHONPATH=.. uvicorn backend.app.main:app --reload --port 8000` |
| **Run Migrations** | `PYTHONPATH=.. python3 db/migrate.py` |
| **Run All Tests** | `PYTHONPATH=.. pytest tests/ -v` |
| **API Docs (Swagger)** | Navigate to `http://localhost:8000/docs` while server runs |

### Frontend Commands (Inside `frontend/`)
| Task | Command |
| :--- | :--- |
| **Start Dev Server** | `npm run dev` (Runs on `http://localhost:5173`) |
| **Build for Production** | `npm run build` |
| **Run Unit Tests** | `npm test` |
| **Run Tests (Watch)** | `npm run test:watch` |
| **Preview Build** | `npm run preview` |

---

## 6. Architecture & Model Design

### System Architecture
The application uses a decoupled 3-tier architecture:
- **Client (Frontend)**: React 18 SPA built with TypeScript, Vite, Tailwind CSS, and Lucide icons. Communicates with backend via REST.
- **API & Analysis (Backend)**: FastAPI running on Python 3.11+. Manages business logic, revision checks, UTF-16 validation, and Gemini LLM prompts.
- **Persistence (Database)**: SQLite file (`journal.db`) with Write-Ahead Logging (`WAL`), strict foreign keys, and indexes.

```
┌────────────────────────────────────────────────────────┐
│                   React 18 SPA Client                  │
│       (Editor, Inline Diff Viewer, Insights Chart)     │
└───────────────────────────┬────────────────────────────┘
                            │ REST / JSON (UTF-16 Offsets)
                            ▼
┌────────────────────────────────────────────────────────┐
│                  FastAPI Backend Server                │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │ Revision Concurrency │    │     AI Service       │  │
│  └──────────┬───────────┘    └──────────┬───────────┘  │
│             │                           │              │
│  ┌──────────▼───────────┐    ┌──────────▼───────────┐  │
│  │ UTF-16 Text Builder  │    │  Taxonomy Validator  │  │
│  └──────────────────────┘    └──────────────────────┘  │
└───────────────────────────┬────────────────────────────┘
                            │ SQLite Driver (WAL Mode)
                            ▼
┌────────────────────────────────────────────────────────┐
│                     journal.db                         │
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
