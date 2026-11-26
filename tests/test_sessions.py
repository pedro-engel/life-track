"""Tests for Task 7: Workout sessions + set entries + idempotent sync."""
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine, select

import app.db as db_module
from app.db import get_session
from app.main import app
from app.auth import hash_password
from app.config import get_settings
from app.models import WorkoutSession, SetEntry

KNOWN_PASSWORD = "my_secure_password_sessions!!"
KNOWN_SECRET = "test-jwt-secret-for-sessions!!XY"  # 32 bytes exactly


@pytest.fixture(name="client")
def client_fixture(tmp_path):
    """TestClient backed by a fresh per-test SQLite DB with valid credentials."""
    db_path = tmp_path / "sessions_test.db"
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


def _make_payload(session_id: str | None = None, num_sets: int = 2) -> dict:
    """Build a valid sync payload."""
    if session_id is None:
        session_id = str(uuid.uuid4())
    sets = [
        {
            "id": str(uuid.uuid4()),
            "exercise_id": 1,
            "position": i,
            "weight": 100.0 + i,
            "reps": 5,
            "note": None,
            "completed": True,
        }
        for i in range(num_sets)
    ]
    return {
        "session": {
            "id": session_id,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "template_id": None,
            "finished_at": None,
        },
        "sets": sets,
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_sync_creates_session_and_sets(client):
    """POST /sessions/sync creates the session and all sets; returns them."""
    token = get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    payload = _make_payload(num_sets=3)
    resp = client.post("/sessions/sync", json=payload, headers=headers)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    data = resp.json()
    assert data["id"] == payload["session"]["id"]
    assert len(data["sets"]) == 3

    # Verify DB has exactly 1 session and 3 set entries
    with Session(db_module.engine) as s:
        sessions = list(s.exec(select(WorkoutSession)))
        entries = list(s.exec(select(SetEntry)))
    assert len(sessions) == 1
    assert len(entries) == 3


def test_sync_same_payload_twice_is_idempotent(client):
    """Sending the same payload twice must not duplicate rows (Review Focus)."""
    token = get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    payload = _make_payload(num_sets=2)

    # First sync
    r1 = client.post("/sessions/sync", json=payload, headers=headers)
    assert r1.status_code == 200

    # Count rows after first sync
    with Session(db_module.engine) as s:
        sessions_before = list(s.exec(select(WorkoutSession)))
        entries_before = list(s.exec(select(SetEntry)))

    # Second sync (identical payload)
    r2 = client.post("/sessions/sync", json=payload, headers=headers)
    assert r2.status_code == 200

    # Count rows after second sync — must be unchanged
    with Session(db_module.engine) as s:
        sessions_after = list(s.exec(select(WorkoutSession)))
        entries_after = list(s.exec(select(SetEntry)))

    assert len(sessions_before) == 1
    assert len(sessions_after) == 1, (
        f"Expected 1 session after second sync; got {len(sessions_after)}"
    )
    assert len(entries_before) == 2
    assert len(entries_after) == 2, (
        f"Expected 2 entries after second sync; got {len(entries_after)}"
    )


def test_sync_updates_existing_set_values(client):
    """Re-syncing with the same set id but different values updates (not duplicates)."""
    token = get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    payload = _make_payload(num_sets=1)
    set_id = payload["sets"][0]["id"]

    # First sync
    r1 = client.post("/sessions/sync", json=payload, headers=headers)
    assert r1.status_code == 200

    # Update the set's weight and reps
    payload["sets"][0]["weight"] = 999.0
    payload["sets"][0]["reps"] = 42

    # Second sync
    r2 = client.post("/sessions/sync", json=payload, headers=headers)
    assert r2.status_code == 200
    data = r2.json()

    # Response should reflect updated values
    updated_set = next(e for e in data["sets"] if e["id"] == set_id)
    assert updated_set["weight"] == 999.0
    assert updated_set["reps"] == 42

    # DB should have exactly 1 session and 1 set entry with updated values
    with Session(db_module.engine) as s:
        entries = list(s.exec(select(SetEntry)))
    assert len(entries) == 1
    assert entries[0].weight == 999.0
    assert entries[0].reps == 42


def test_history_orders_most_recent_first(client):
    """GET /sessions returns sessions ordered by started_at descending."""
    token = get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    base = datetime(2024, 1, 1, tzinfo=timezone.utc)
    ids = [str(uuid.uuid4()) for _ in range(3)]

    # Insert sessions in chronological order (oldest first)
    for i, sid in enumerate(ids):
        payload = {
            "session": {
                "id": sid,
                "started_at": (base + timedelta(days=i)).isoformat(),
                "template_id": None,
                "finished_at": None,
            },
            "sets": [],
        }
        resp = client.post("/sessions/sync", json=payload, headers=headers)
        assert resp.status_code == 200

    # GET /sessions should return most-recent first
    resp = client.get("/sessions", headers=headers)
    assert resp.status_code == 200
    returned_ids = [s["id"] for s in resp.json()]
    expected = list(reversed(ids))  # newest (index 2) first
    assert returned_ids == expected, (
        f"Expected most-recent-first {expected}; got {returned_ids}"
    )


def test_negative_weight_or_reps_rejected_422(client):
    """weight < 0 or reps < 0 returns 422; zero is accepted (Review Focus)."""
    token = get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    base = _make_payload(num_sets=1)

    # Negative weight → 422
    neg_weight = {
        **base,
        "session": {**base["session"], "id": str(uuid.uuid4())},
        "sets": [{**base["sets"][0], "weight": -1.0, "id": str(uuid.uuid4())}],
    }
    r = client.post("/sessions/sync", json=neg_weight, headers=headers)
    assert r.status_code == 422, (
        f"Expected 422 for negative weight, got {r.status_code}: {r.text}"
    )

    # Negative reps → 422
    neg_reps = {
        **base,
        "session": {**base["session"], "id": str(uuid.uuid4())},
        "sets": [{**base["sets"][0], "reps": -1, "id": str(uuid.uuid4())}],
    }
    r = client.post("/sessions/sync", json=neg_reps, headers=headers)
    assert r.status_code == 422, (
        f"Expected 422 for negative reps, got {r.status_code}: {r.text}"
    )

    # Zero weight → 200 (bodyweight exercises)
    zero_weight = {
        **base,
        "session": {**base["session"], "id": str(uuid.uuid4())},
        "sets": [{**base["sets"][0], "weight": 0.0, "id": str(uuid.uuid4())}],
    }
    r = client.post("/sessions/sync", json=zero_weight, headers=headers)
    assert r.status_code == 200, (
        f"Expected 200 for zero weight, got {r.status_code}: {r.text}"
    )

    # Zero reps → 200
    zero_reps = {
        **base,
        "session": {**base["session"], "id": str(uuid.uuid4())},
        "sets": [{**base["sets"][0], "reps": 0, "id": str(uuid.uuid4())}],
    }
    r = client.post("/sessions/sync", json=zero_reps, headers=headers)
    assert r.status_code == 200, (
        f"Expected 200 for zero reps, got {r.status_code}: {r.text}"
    )
