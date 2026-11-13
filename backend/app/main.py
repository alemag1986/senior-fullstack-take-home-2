import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
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

# Root health check endpoint for container orchestrators and DO healthchecks
@app.get("/health", tags=["health"])
def root_health_check() -> dict:
    return {"status": "ok"}

# Include API routes
app.include_router(health.router, prefix="/api")
app.include_router(entries.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
app.include_router(decisions.router, prefix="/api")
app.include_router(insights.router, prefix="/api")

# Determine Frontend Dist directory
FRONTEND_DIST = os.getenv("FRONTEND_DIST_DIR")
if FRONTEND_DIST:
    dist_dir = Path(FRONTEND_DIST)
else:
    # Check standard local and container directory structures
    candidates = [
        Path("/app/frontend/dist"),
        Path(__file__).resolve().parent.parent.parent / "frontend" / "dist",
        Path("frontend/dist"),
    ]
    dist_dir = next((p for p in candidates if p.is_dir() and (p / "index.html").is_file()), None)

if dist_dir and dist_dir.is_dir():
    assets_dir = dist_dir / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path == "api" or full_path == "health":
            raise HTTPException(status_code=404, detail="Not Found")

        file_path = dist_dir / full_path
        if full_path and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(dist_dir / "index.html")

