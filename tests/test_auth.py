"""Tests for Task 3: Authentication (password login + JWT, auth dependency)."""
import os

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine

import app.db as db_module
from app.db import get_session
from app.main import app
from app.auth import hash_password, require_auth
from app.config import get_settings

# ---------------------------------------------------------------------------
# Throwaway protected route to exercise require_auth in tests.
# Registered once at module load; harmless in production since the app is
# never served from the test suite.
# ---------------------------------------------------------------------------
@app.get("/test-auth-protected")
def _test_protected(sub: str = Depends(require_auth)):
    return {"subject": sub}


KNOWN_PASSWORD = "my_secure_password_123"
KNOWN_SECRET = "test-jwt-secret-for-auth-tests"


@pytest.fixture(name="auth_client")
def auth_client_fixture(tmp_path):
    """TestClient backed by fresh SQLite DB with known credentials injected
    via env-var override + lru_cache clear."""
    db_path = tmp_path / "auth_test.db"
    db_url = f"sqlite:///{db_path}"

    # Compute the bcrypt hash for the known password BEFORE clearing cache
    known_hash = hash_password(KNOWN_PASSWORD)

    # Inject credentials into env so pydantic-settings picks them up
    os.environ["APP_PASSWORD_HASH"] = known_hash
    os.environ["JWT_SECRET"] = KNOWN_SECRET
    get_settings.cache_clear()

    test_engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(test_engine)

    original_engine = db_module.engine
    db_module.engine = test_engine

    def override_session():
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()
    db_module.engine = original_engine
    test_engine.dispose()

    # Restore clean state
    os.environ.pop("APP_PASSWORD_HASH", None)
    os.environ.pop("JWT_SECRET", None)
    get_settings.cache_clear()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_login_wrong_password_401(auth_client):
    """POST /auth/login with wrong password returns 401."""
    response = auth_client.post("/auth/login", json={"password": "wrong_password"})
    assert response.status_code == 401


def test_login_correct_password_returns_token(auth_client):
    """POST /auth/login with correct password returns 200 and a token string."""
    response = auth_client.post("/auth/login", json={"password": KNOWN_PASSWORD})
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert isinstance(data["token"], str)
    assert len(data["token"]) > 10


def test_protected_route_without_token_401(auth_client):
    """GET /test-auth-protected with no Authorization header returns 401."""
    response = auth_client.get("/test-auth-protected")
    assert response.status_code == 401


def test_protected_route_with_token_200(auth_client):
    """GET /test-auth-protected with valid Bearer token returns 200."""
    token = auth_client.post(
        "/auth/login", json={"password": KNOWN_PASSWORD}
    ).json()["token"]

    response = auth_client.get(
        "/test-auth-protected",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
