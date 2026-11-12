# Backend — AI Language Journal API

This folder contains the REST API service and AI analysis pipeline for the AI-Assisted Language Journaling project.

## Technology Stack
- **Framework**: Python 3.11+ / FastAPI
- **Data Validation**: Pydantic v2
- **AI Integration**: Google GenAI SDK (`google-genai`) with mock fallback for local tests
- **Testing**: `pytest`, `pytest-asyncio`, `httpx`

## Structure
```
backend/
├── app/
│   ├── api/            # Route handlers (entries, insights, health)
│   ├── core/           # Configuration, database connection, settings
│   ├── models/         # Pydantic schemas (requests, responses, AI structured outputs)
│   ├── services/       # AI feedback engine, defensive parser, analytics
│   └── main.py         # FastAPI application entrypoint
├── tests/              # Automated unit and integration tests
├── requirements.txt
└── .env.example
```

## Getting Started
```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run backend API server
uvicorn app.main:app --reload --port 8000

# Run automated tests
pytest
```
