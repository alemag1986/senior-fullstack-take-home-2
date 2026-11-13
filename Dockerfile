# syntax=docker/dockerfile:1

########## Stage 1: frontend-builder ##########
FROM node:20-alpine AS frontend-builder

WORKDIR /build-frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


########## Stage 2: python-builder ##########
FROM python:3.12-slim AS python-builder

WORKDIR /build-python

RUN apt-get update && apt-get install --no-install-recommends -y \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .

# Pre-build wheels so the runtime stage needs no compiler or network
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt


########## Stage 3: runtime ##########
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_HOME=/app \
    PYTHONPATH=/app \
    DATABASE_PATH=/data/journal.db \
    FRONTEND_DIST_DIR=/app/frontend/dist

WORKDIR $APP_HOME

# tini: proper PID 1 (signal forwarding + zombie reaping)
RUN apt-get update && apt-get install --no-install-recommends -y tini \
    && rm -rf /var/lib/apt/lists/*

# Install only the pre-built wheels — no index, no cache, no compiler
COPY --from=python-builder /wheels /wheels
COPY backend/requirements.txt .
RUN pip install --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels

# Setup non-root app user and persistent data storage mount directory
RUN groupadd --system app && useradd --system --gid app --no-create-home app \
    && mkdir -p /data $APP_HOME \
    && chown -R app:app /data $APP_HOME

# Copy application source and compiled frontend
COPY --chown=app:app ./backend ./backend
COPY --chown=app:app --from=frontend-builder /build-frontend/dist ./frontend/dist

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# tini as PID 1 -> gunicorn manages uvicorn workers -> auto restart dead workers, graceful shutdown via SIGTERM
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", \
     "-w", "2", \
     "--max-requests", "10000", "--max-requests-jitter", "500", \
     "--graceful-timeout", "30", "--timeout", "60", \
     "--bind", "0.0.0.0:8000", \
     "backend.app.main:app"]
