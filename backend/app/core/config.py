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
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-1.5-flash"


settings = Settings()
