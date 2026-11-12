from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api.routes import analysis, decisions, entries, health, insights
from backend.app.core.config import settings
from backend.app.core.database import init_db
from backend.app.core.errors import register_error_handlers


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    init_db(settings.DATABASE_PATH)
    yield


app = FastAPI(
    title="AI Language Journal API",
    description="Backend service for AI-assisted language journaling.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for frontend SPA
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register uniform error envelope handlers
register_error_handlers(app)

# Include API routes
app.include_router(health.router, prefix="/api")
app.include_router(entries.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
app.include_router(decisions.router, prefix="/api")
app.include_router(insights.router, prefix="/api")
