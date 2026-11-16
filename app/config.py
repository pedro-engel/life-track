from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./strength_tracker.db"
    JWT_SECRET: str = "test-jwt-secret"
    APP_PASSWORD_HASH: str = "test-password-hash"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance.

    Tests can inject different values by setting env vars and calling
    ``get_settings.cache_clear()`` before/after each test.
    """
    return Settings()


# Backward-compatible module-level alias used by db.py at import time.
settings = get_settings()
