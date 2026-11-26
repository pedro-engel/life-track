"""Tests for Task 10: per-exercise progress series."""
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

KNOWN_PASSWORD = "my_secure_password_progress10!!"
KNOWN_SECRET = "test-jwt-secret-progress10!!XY12"  # exactly 32 bytes


@pytest.fixture(name="client")
def client_fixture(tmp_path):
    """TestClient backed by a fresh per-test SQLite DB with valid credentials."""
    db_path = tmp_path / "progress10_test.db"
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


def _sync_session(
    client: TestClient, token: str, started_at: datetime, sets: list[dict]
) -> str:
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


def test_progress_series_one_point_per_session_chronological(client):
    """Several sessions logging the same exercise → one point each, ascending by started_at."""
    token = get_token(client)
    base = datetime(2024, 1, 1, tzinfo=timezone.utc)
    exercise_id = 1

    # Three sessions on successive weeks, each with a single set
    for week, weight in enumerate([50.0, 55.0, 60.0]):
        _sync_session(
            client,
            token,
            started_at=base + timedelta(weeks=week),
            sets=[
                {
                    "exercise_id": exercise_id,
                    "position": 0,
                    "weight": weight,
                    "reps": 5,
                    "note": None,
                    "completed": True,
                }
            ],
        )

    resp = client.get(
        f"/exercises/{exercise_id}/progress",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()

    # Exactly 3 points — one per session
    assert len(data) == 3, f"Expected 3 points, got {len(data)}: {data}"

    # Chronological order: top_weight should go 50 → 55 → 60
    top_weights = [p["top_weight"] for p in data]
    assert top_weights == [50.0, 55.0, 60.0], (
        f"Expected ascending weights [50, 55, 60], got {top_weights}"
    )

    # Confirm dates are ascending
    dates = [p["date"] for p in data]
    assert dates == sorted(dates), f"Expected ascending dates, got {dates}"

    # Each point has the required keys
    for point in data:
        assert "date" in point
        assert "top_weight" in point
        assert "total_reps" in point


def test_progress_top_weight_is_max_of_sets(client):
    """A session with multiple sets → top_weight is max(weight), total_reps is sum(reps)."""
    token = get_token(client)
    base = datetime(2024, 3, 1, tzinfo=timezone.utc)
    exercise_id = 2

    # One session, three sets with different weights
    _sync_session(
        client,
        token,
        started_at=base,
        sets=[
            {
                "exercise_id": exercise_id,
                "position": 0,
                "weight": 40.0,
                "reps": 10,
                "note": None,
                "completed": True,
            },
            {
                "exercise_id": exercise_id,
                "position": 1,
                "weight": 45.0,
                "reps": 8,
                "note": None,
                "completed": True,
            },
            {
                "exercise_id": exercise_id,
                "position": 2,
                "weight": 50.0,
                "reps": 6,
                "note": None,
                "completed": True,
            },
        ],
    )

    resp = client.get(
        f"/exercises/{exercise_id}/progress",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert len(data) == 1, f"Expected 1 point for 1 session, got {len(data)}"
    point = data[0]

    # top_weight = max(40, 45, 50) = 50
    assert point["top_weight"] == 50.0, (
        f"Expected top_weight=50.0, got {point['top_weight']}"
    )
    # total_reps = 10 + 8 + 6 = 24
    assert point["total_reps"] == 24, (
        f"Expected total_reps=24, got {point['total_reps']}"
    )


def test_progress_empty_for_unlogged_exercise(client):
    """Exercise that never appeared in any session → empty list [], NOT 404."""
    token = get_token(client)

    # exercise_id=999 has never been synced
    resp = client.get(
        "/exercises/999/progress",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, (
        f"Expected 200 (empty list), got {resp.status_code}: {resp.text}"
    )
    data = resp.json()
    assert data == [], f"Expected empty list, got {data}"
