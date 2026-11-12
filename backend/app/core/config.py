from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_PATH: str = "journal.db"
    DEFAULT_USER_ID: str = "dev-user-default"
    TAXONOMY_VERSION: str = "1.0.0"
    MAX_ENTRY_CONTENT_LENGTH: int = 10000

    # AI Provider: "openrouter" | "gemini" | "heuristic"
    AI_PROVIDER: str = "openrouter"

    # OpenRouter Configuration
    OPENROUTER_API_KEY: str | None = None
    OPENROUTER_MODEL: str = "google/gemini-2.0-flash-001"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_SITE_URL: str = "http://localhost:5173"
    OPENROUTER_APP_NAME: str = "AI-Assisted Language Journaling"
    OPENROUTER_TIMEOUT_SECONDS: float = 20.0

    # Gemini Configuration (alternative provider)
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-1.5-flash"


settings = Settings()
