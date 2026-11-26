"""Tests for Task 8: "Última vez" last-time reference lookup for sets."""
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine

import app.db as db_module
from app.db import get_session
from app.main import app
from app.auth import hash_password
from app.config import get_settings

KNOWN_PASSWORD = "my_secure_password_progress!!"
KNOWN_SECRET = "test-jwt-secret-for-progress!!XY"  # exactly 32 bytes


@pytest.fixture(name="client")
def client_fixture(tmp_path):
    """TestClient backed by a fresh per-test SQLite DB with valid credentials."""
    db_path = tmp_path / "progress_test.db"
    db_url = f"sqlite:///{db_path}"

    known_hash = hash_password(KNOWN_PASSWORD)

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

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
    db_module.engine = original_engine
    test_engine.dispose()

    os.environ.pop("APP_PASSWORD_HASH", None)
    os.environ.pop("JWT_SECRET", None)
    get_settings.cache_clear()


def get_token(client: TestClient) -> str:
    """Obtain a valid Bearer token from the login endpoint."""
    resp = client.post("/auth/login", json={"password": KNOWN_PASSWORD})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["token"]


def _sync_session(client: TestClient, token: str, started_at: datetime, sets: list[dict]) -> str:
    """Sync a session with the given sets and return the session ID."""
    session_id = str(uuid.uuid4())
    payload = {
        "session": {
            "id": session_id,
            "started_at": started_at.isoformat(),
            "template_id": None,
            "finished_at": None,
        },
        "sets": [{"id": str(uuid.uuid4()), **s} for s in sets],
    }
    resp = client.post(
        "/sessions/sync",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, f"sync failed: {resp.text}"
    return session_id


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_last_set_returns_same_index_from_prior_session(client):
    """When the prior session has a set at the queried position, return it."""
    token = get_token(client)
    base = datetime(2024, 6, 1, tzinfo=timezone.utc)
    exercise_id = 1

    # Prior session: 3 sets at positions 0, 1, 2
    _sync_session(
        client,
        token,
        started_at=base,
        sets=[
            {"exercise_id": exercise_id, "position": 0, "weight": 40.0, "reps": 10, "note": None, "completed": True},
            {"exercise_id": exercise_id, "position": 1, "weight": 42.5, "reps": 8, "note": None, "completed": True},
            {"exercise_id": exercise_id, "position": 2, "weight": 45.0, "reps": 6, "note": None, "completed": True},
        ],
    )

    resp = client.get(
        f"/exercises/{exercise_id}/last-set?position=1",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data is not None
    assert data["weight"] == 42.5
    assert data["reps"] == 8


def test_last_set_falls_back_to_last_set_when_fewer(client):
    """When the prior session logged fewer sets (no set at N), return max position <= N."""
    token = get_token(client)
    base = datetime(2024, 7, 1, tzinfo=timezone.utc)
    exercise_id = 1

    # Prior session: only 2 sets (positions 0 and 1)
    _sync_session(
        client,
        token,
        started_at=base,
        sets=[
            {"exercise_id": exercise_id, "position": 0, "weight": 50.0, "reps": 5, "note": None, "completed": True},
            {"exercise_id": exercise_id, "position": 1, "weight": 55.0, "reps": 5, "note": None, "completed": True},
        ],
    )

    # Query position=3: session only has positions 0 and 1 → fall back to position 1
    resp = client.get(
        f"/exercises/{exercise_id}/last-set?position=3",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data is not None
    # Falls back to position 1 (max position <= 3)
    assert data["weight"] == 55.0
    assert data["reps"] == 5


def test_last_set_returns_null_for_never_logged_exercise(client):
    """When the exercise was never logged, return null (HTTP 200 with null body)."""
    token = get_token(client)
    # exercise_id=999 has never appeared in any session
    resp = client.get(
        "/exercises/999/last-set?position=0",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() is None


def test_last_set_exclude_session_id_returns_older_session(client):
    """GET /exercises/{id}/last-set?exclude_session_id=X skips that session.

    Two sessions logged the exercise; querying with exclude_session_id equal to
    the newer session's id must return the OLDER session's set.
    This test fails before the fix (extra param ignored → returns newer) and
    passes after (newer session filtered out → returns older).
    """
    token = get_token(client)
    exercise_id = 2  # use a different id from other tests to keep state isolated
    base = datetime(2024, 10, 1, tzinfo=timezone.utc)

    # Older session: weight=30kg
    _sync_session(
        client,
        token,
        started_at=base,
        sets=[
            {"exercise_id": exercise_id, "position": 0, "weight": 30.0, "reps": 12, "note": None, "completed": True},
        ],
    )

    # Newer session: weight=35kg
    newer_session_id = _sync_session(
        client,
        token,
        started_at=base + timedelta(days=7),
        sets=[
            {"exercise_id": exercise_id, "position": 0, "weight": 35.0, "reps": 10, "note": None, "completed": True},
        ],
    )

    # Without exclusion: newer session's set is returned
    resp = client.get(
        f"/exercises/{exercise_id}/last-set?position=0",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["weight"] == 35.0, "Sanity: without exclusion the newer set is returned"

    # With exclude_session_id=newer: older session's set must be returned
    resp = client.get(
        f"/exercises/{exercise_id}/last-set?position=0&exclude_session_id={newer_session_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data is not None, "Expected a result from the older session, not null"
    assert data["weight"] == 30.0, (
        f"Expected older session's weight (30.0) but got {data['weight']}"
    )


def test_last_set_picks_most_recent_prior_session(client):
    """When the exercise was logged in multiple sessions, return from the most recent."""
    token = get_token(client)
    exercise_id = 1
    base = datetime(2024, 8, 1, tzinfo=timezone.utc)

    # Older session: position 0, weight=30kg
    _sync_session(
        client,
        token,
        started_at=base,
        sets=[
            {"exercise_id": exercise_id, "position": 0, "weight": 30.0, "reps": 12, "note": None, "completed": True},
        ],
    )

    # Newer session: position 0, weight=35kg — this one should be returned
    _sync_session(
        client,
        token,
        started_at=base + timedelta(days=7),
        sets=[
            {"exercise_id": exercise_id, "position": 0, "weight": 35.0, "reps": 10, "note": None, "completed": True},
        ],
    )

    resp = client.get(
        f"/exercises/{exercise_id}/last-set?position=0",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data is not None
    assert data["weight"] == 35.0, (
        f"Expected most-recent session (35kg) but got {data['weight']}"
    )
