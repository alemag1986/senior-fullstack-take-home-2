# AI-Assisted Language Journaling — Gemini Developer Rules & Guidelines

This document provides system guidelines, architectural boundaries, tech stack specifications, and testing requirements for developing the AI-Assisted Language Journaling application (see [challenge.md](challenge.md)).

---

## 1. Project Overview & Scope

The application helps language learners practice through regular journaling:
- **Stage 1 (Core)**:
  - Create journal entries in a target foreign language (e.g., Spanish, French, German, Japanese).
  - Submit entry for AI-powered feedback (corrections, explanations, vocabulary/grammar improvements).
  - Review past entries and their corresponding feedback in an entry history list.
- **Stage 2 (Extension)**:
  - Categorize and store structured mistake data (e.g., grammar, spelling, word choice, syntax).
  - Aggregate mistakes across entries to display learning insights and improvement trends over time.

---

## 2. Directory Structure & Technologies

The codebase is split into three decoupled components:

```
applied-computing/
├── frontend/        # React + TypeScript + Vite Single Page Application (SPA)
├── backend/         # FastAPI (Python 3.11+) REST API & AI Service
├── db/              # SQLite DDL scripts, initialization, and seed data
├── challenge.md     # Assignment specification
├── GEMINI.md        # Workspace rules and technical guidance (this file)
└── .gitignore       # Git ignore rules for node, python, sqlite, and env
```

### 2.1. `frontend/` (SPA Client)
- **Framework & Language**: React 18+ with TypeScript.
- **Bundler & Tooling**: Vite.
- **Styling**: Tailwind CSS.
- **Testing**: Vitest + React Testing Library.
- **Conventions**:
  - Keep UI components focused and modular under `src/components/`.
  - Centralize API calls under `src/api/`.
  - Centralize data models under `src/types/`.

### 2.2. `backend/` (API & AI Service)
- **Framework & Language**: Python 3.11+ with FastAPI.
- **Data Validation & Schemas**: Pydantic v2 for request/response validation and strict structured AI parsing.
- **AI Integration**:
  - Google Gemini API (`google-genai` SDK) or compatible LLM provider.
  - Implement defensive response parsing: strip markdown fencing (````json ... ````), handle malformed or unexpected responses with graceful fallbacks.
  - Allow mock AI mode when `GEMINI_API_KEY` is not present, ensuring local execution and offline tests always pass without network access.
- **Testing**: `pytest`, `pytest-asyncio`, and `httpx` (FastAPI `TestClient`).
- **Endpoints**:
  - `POST /api/entries`: Submit a journal entry; triggers AI analysis, persists entry + feedback + mistakes, returns result.
  - `GET /api/entries`: Retrieve list of entries (with pagination or reverse chronological order).
  - `GET /api/entries/{id}`: Retrieve entry by ID with complete corrections and structured mistakes.
  - `GET /api/insights`: (Stage 2) Aggregated mistake distribution, frequency, and trends over time.
  - `GET /api/health`: Health check endpoint.

### 2.3. `db/` (Database & Scripts)
- **Database Engine**: SQLite (file-based `journal.db` located at project root or backend directory, zero setup required).
- **Scripts**:
  - `schema.sql`: DDL for tables (`entries`, `feedback`, `mistakes`).
  - `init_db.py`: Python script to create or reset tables and load test seed data if desired.
- **Schema Design**:
  - `entries`: `id` (INTEGER PK / UUID), `language` (TEXT), `content` (TEXT), `created_at` (TIMESTAMP).
  - `feedback`: `id` (PK), `entry_id` (FK -> entries.id), `corrected_text` (TEXT), `overall_comment` (TEXT), `created_at` (TIMESTAMP).
  - `mistakes`: `id` (PK), `entry_id` (FK -> entries.id), `category` (TEXT e.g. grammar, vocabulary, spelling), `original_fragment` (TEXT), `replacement` (TEXT), `explanation` (TEXT).

---

## 3. Testing Standards & Expectations

Every critical path must be backed by automated tests:

### 3.1. Backend Tests (`backend/tests/`)
1. **Defensive AI Response Handling**:
   - Test handling of valid JSON output from LLM.
   - Test handling of JSON embedded inside markdown code blocks.
   - Test handling of malformed JSON or schema mismatches without crashing (returns clean error or graceful fallback).
2. **Core Flow Integration Test**:
   - `Create Entry -> AI Analyze -> Save to DB -> Retrieve Entry -> Verify feedback & mistakes`.
3. **Stage 2 Aggregation Logic**:
   - Unit tests verifying mistake frequency calculation and trend categorization.

### 3.2. Frontend Tests (`frontend/src/`)
1. Component unit tests for:
   - Journal entry submission form and validation.
   - Correction/diff rendering component (displaying original vs. corrected fragments).
   - Empty and error state displays.

---

## 4. Execution & Local Development Guidelines

1. **Keep Setup Simple**:
   - The user must be able to run the project locally with minimal commands (e.g. `pip install -r requirements.txt && uvicorn app.main:app` and `npm install && npm run dev`).
2. **Defensive Code Over Fragile Assumptions**:
   - Always validate AI outputs with Pydantic models before inserting into the database or returning to the client.
3. **Security**:
   - Never commit API keys or credentials. Use `.env` with a provided `.env.example`.
