# VS Code HTTP Client Test Suite

This directory contains the VS Code HTTP client test file (`api.http`) for testing all endpoints of the AI-Assisted Language Journaling API.

---

## 1. Prerequisites

### Install the VS Code REST Client Extension
Install the popular [REST Client extension by Huachao Mao](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) in Visual Studio Code (or use VS Code's native HTTP request editor).

### Start the Backend Server
From the project root:
```bash
cd backend
source .venv/bin/activate
PYTHONPATH=.. uvicorn app.main:app --reload --port 8000
```
The API will be available at `http://localhost:8000`.

---

## 2. Using `api.http`

1. Open `requests/api.http` in VS Code.
2. You will see a clickable **`Send Request`** button above each HTTP request line (e.g., above `GET {{baseUrl}}/health`).
3. Click **`Send Request`** to execute any request and view the response in a split pane.

### Request Chaining
Requests use REST Client's named request syntax (`# @name <name>`).
When you execute requests sequentially from top to bottom:
- Creating an entry (`createEntry`) automatically captures its `id` into `@createdEntryId`.
- Analyzing an entry (`analyzeEntry`) automatically captures `entryId`, `analysisId`, and the first `suggestionId`.
- Ingesting manual analyses captures the generated suggestion ID for the decisions endpoint.
- Decision requests use these captured IDs to accept or dismiss suggestions and increment entry revisions.

---

## 3. Endpoints Covered

| Category | Method & Path | Description |
|---|---|---|
| **Health** | `GET /api/health` | Service uptime and status |
| **Entries** | `POST /api/entries` | Create new journal entry (Revision 1) |
| **Entries** | `GET /api/entries` | List entries for current user in reverse chronological order |
| **Entries** | `GET /api/entries/{id}` | Retrieve single entry by ID with ownership check |
| **Entries** | `POST /api/entries` | Update entry with optimistic concurrency check (`expectedRevision`) |
| **Analysis** | `POST /api/entries/analyze` | AI linguistic feedback generating suggestions & UTF-16 offsets |
| **Analysis** | `GET /api/analyses/{id}` | Retrieve analysis snapshot and suggestions |
| **Analysis** | `POST /api/analyses` | Directly ingest validated analysis snapshot |
| **Decisions** | `POST /api/entries/{id}/decisions` | Apply suggestion decisions (accept -> text rebuild, dismiss) |
| **Decisions** | `POST /api/entries/{id}/decisions` | Test idempotency with `requestId` replay |
| **Insights** | `GET /api/insights` | Aggregate statistics, category distribution, top mistakes & trends |
| **Auth & Errors** | `GET /api/entries` | Multi-tenancy check with secondary `X-Session-ID` |
| **Auth & Errors** | `GET /api/entries/{id}` | Forbidden access check (403 for cross-user resource) |
| **Auth & Errors** | `GET /api/entries/{id}` | Not found check (404) |
| **Auth & Errors** | `POST /api/entries` | Concurrency conflict check (409) and validation error (422) |

---

## 4. Customizing Variables

At the top of `requests/api.http`, you can change the environment variables as needed:
```http
@baseUrl = http://localhost:8000/api
@contentType = application/json
@sessionId = dev-user-default
@altSessionId = user-secondary
```
