from functools import lru_cache

from pydantic_settings import BaseSettings


class InsecureDefaultKeyWarning(UserWarning):
    """Emitted at startup when JWT_SECRET is left at the insecure factory default."""


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./strength_tracker.db"
    JWT_SECRET: str = "test-jwt-secret"
    # Default is a valid bcrypt hash of the literal string "REPLACE_ME" so that
    # a misconfigured app returns 401 (verify fails) rather than 500 (ValueError).
    APP_PASSWORD_HASH: str = (
        "$2b$12$FsHdvNfgPt/9R4QFm04IcuBQt4UaKOt6KFhk/61Wgno5W5ndrurA2"
    )

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
