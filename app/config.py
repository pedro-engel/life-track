from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./strength_tracker.db"
    JWT_SECRET: str = "test-jwt-secret"
    APP_PASSWORD_HASH: str = "test-password-hash"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
