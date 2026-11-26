"""Tests for Task 9: Body weight entries."""
import os
from datetime import datetime, timezone, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine

import app.db as db_module
from app.db import get_session
from app.main import app
from app.auth import hash_password
from app.config import get_settings

KNOWN_PASSWORD = "my_secure_password_bodyweight!!"
KNOWN_SECRET = "test-jwt-secret-for-bodyweight!XY"  # 32 bytes exactly


@pytest.fixture(name="client")
def client_fixture(tmp_path):
    """TestClient backed by a fresh per-test SQLite DB with valid credentials."""
    db_path = tmp_path / "bodyweight_test.db"
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


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_log_bodyweight(client):
    """POST /bodyweight creates an entry and returns it."""
    token = get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    recorded_at = datetime(2024, 6, 1, 8, 0, 0, tzinfo=timezone.utc).isoformat()
    resp = client.post(
        "/bodyweight",
        json={"weight": 75.5, "recorded_at": recorded_at},
        headers=headers,
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    data = resp.json()
    assert data["weight"] == 75.5
    assert "id" in data
    assert data["id"] is not None
    assert "recorded_at" in data


def test_log_bodyweight_defaults_recorded_at(client):
    """POST /bodyweight without recorded_at defaults to now (server timestamp)."""
    token = get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    before = datetime.now(timezone.utc)
    resp = client.post("/bodyweight", json={"weight": 80.0}, headers=headers)
    after = datetime.now(timezone.utc)

    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["weight"] == 80.0

    recorded_at = datetime.fromisoformat(data["recorded_at"].replace("Z", "+00:00"))
    assert before <= recorded_at <= after, (
        f"recorded_at {recorded_at} not between {before} and {after}"
    )


def test_list_bodyweight_ordered_by_time(client):
    """GET /bodyweight returns all entries ordered by recorded_at ascending."""
    token = get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    base = datetime(2024, 1, 1, tzinfo=timezone.utc)
    # Map: day offset → weight (not sorted by weight on purpose)
    day_weight = [(0, 75.0), (1, 76.5), (2, 74.0)]

    # Insert in reverse order (newest first) to prove ordering is by time, not insertion
    for day_offset, w in reversed(day_weight):
        ts = (base + timedelta(days=day_offset)).isoformat()
        resp = client.post(
            "/bodyweight", json={"weight": w, "recorded_at": ts}, headers=headers
        )
        assert resp.status_code == 200

    resp = client.get("/bodyweight", headers=headers)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    entries = resp.json()
    assert len(entries) == 3

    # Must be ascending by recorded_at (oldest first)
    times = [e["recorded_at"] for e in entries]
    assert times == sorted(times), (
        f"Expected ascending order, got {times}"
    )
    # Weights must follow the day-ascending order: day0=75.0, day1=76.5, day2=74.0
    returned_weights = [e["weight"] for e in entries]
    assert returned_weights == [75.0, 76.5, 74.0], (
        f"Expected [75.0, 76.5, 74.0] in date-ascending order; got {returned_weights}"
    )


def test_two_entries_same_day_both_kept(client):
    """Two entries on the same day must both be stored (no deduplication)."""
    token = get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    day = datetime(2024, 3, 15, tzinfo=timezone.utc)
    morning = day.replace(hour=7).isoformat()
    evening = day.replace(hour=20).isoformat()

    r1 = client.post(
        "/bodyweight", json={"weight": 80.0, "recorded_at": morning}, headers=headers
    )
    r2 = client.post(
        "/bodyweight", json={"weight": 79.5, "recorded_at": evening}, headers=headers
    )
    assert r1.status_code == 200
    assert r2.status_code == 200

    resp = client.get("/bodyweight", headers=headers)
    assert resp.status_code == 200
    entries = resp.json()
    assert len(entries) == 2, (
        f"Expected 2 entries (no dedup by day); got {len(entries)}"
    )


def test_nonpositive_weight_rejected_422(client):
    """weight <= 0 returns 422 (Review Focus)."""
    token = get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    recorded_at = datetime(2024, 6, 1, tzinfo=timezone.utc).isoformat()

    # weight = 0 → 422
    r = client.post(
        "/bodyweight",
        json={"weight": 0.0, "recorded_at": recorded_at},
        headers=headers,
    )
    assert r.status_code == 422, (
        f"Expected 422 for weight=0, got {r.status_code}: {r.text}"
    )

    # negative weight → 422
    r = client.post(
        "/bodyweight",
        json={"weight": -1.5, "recorded_at": recorded_at},
        headers=headers,
    )
    assert r.status_code == 422, (
        f"Expected 422 for weight=-1.5, got {r.status_code}: {r.text}"
    )
