"""Tests for Task 4: Exercise catalog (CRUD + base-list seed)."""
import os
import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine

import app.db as db_module
from app.db import get_session
from app.main import app
from app.auth import hash_password
from app.config import get_settings

KNOWN_PASSWORD = "my_secure_password_123"
KNOWN_SECRET = "test-jwt-secret-for-exercises!!X"  # 32 bytes exactly


@pytest.fixture(name="auth_client")
def auth_client_fixture(tmp_path):
    """TestClient backed by a fresh per-test SQLite DB with valid credentials."""
    db_path = tmp_path / "ex_test.db"
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

    with TestClient(app) as client:
        yield client

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

def test_seed_populates_base_exercises(auth_client):
    """After init_db, the exercise table contains base exercises with is_custom=False."""
    token = get_token(auth_client)
    response = auth_client.get(
        "/exercises",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    exercises = response.json()
    assert len(exercises) == 25, (
        f"Expected 25 seeded exercises, got {len(exercises)}"
    )
    assert all(ex["is_custom"] is False for ex in exercises), (
        "All seeded exercises must have is_custom=False"
    )


def test_create_custom_exercise(auth_client):
    """POST /exercises creates a new exercise with is_custom=True."""
    token = get_token(auth_client)
    response = auth_client.post(
        "/exercises",
        json={"name": "My Custom Curl", "muscle_group": "arms"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "My Custom Curl"
    assert data["muscle_group"] == "arms"
    assert data["is_custom"] is True
    assert data["id"] is not None


def test_filter_by_muscle_group(auth_client):
    """GET /exercises?muscle_group=chest returns only chest exercises."""
    token = get_token(auth_client)
    response = auth_client.get(
        "/exercises?muscle_group=chest",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    exercises = response.json()
    assert len(exercises) > 0, "Expected chest exercises from seed; found none"
    assert all(ex["muscle_group"] == "chest" for ex in exercises), (
        "Filtered list must contain only chest exercises"
    )


def test_edit_exercise_name(auth_client):
    """PATCH /exercises/{id} updates the exercise name."""
    token = get_token(auth_client)

    # Grab the first seeded exercise
    exercises = auth_client.get(
        "/exercises",
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    assert len(exercises) > 0
    exercise_id = exercises[0]["id"]

    response = auth_client.patch(
        f"/exercises/{exercise_id}",
        json={"name": "Updated Exercise Name"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Exercise Name"
    assert data["id"] == exercise_id


def test_patch_nonexistent_exercise_returns_404(auth_client):
    """PATCH /exercises/999999 returns 404 when the exercise does not exist."""
    token = get_token(auth_client)
    response = auth_client.patch(
        "/exercises/999999",
        json={"name": "Ghost"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404


def test_exercises_require_auth(auth_client):
    """All exercise endpoints return 401 when no Authorization header is provided."""
    assert auth_client.get("/exercises").status_code == 401
    assert auth_client.post(
        "/exercises", json={"name": "X", "muscle_group": "chest"}
    ).status_code == 401
    assert auth_client.patch("/exercises/1", json={"name": "Y"}).status_code == 401


def test_editing_exercise_keeps_past_set_entry_intact(auth_client):
    """Review Focus: renaming an exercise must not corrupt past SetEntry records.

    Creates an exercise, logs a WorkoutSession + SetEntry referencing it,
    renames the exercise via PATCH, then asserts the past SetEntry still
    resolves with its original weight and reps.
    """
    from app.models import WorkoutSession, SetEntry, Exercise

    token = get_token(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a custom exercise
    ex_resp = auth_client.post(
        "/exercises",
        json={"name": "Deadlift Classic", "muscle_group": "back"},
        headers=headers,
    )
    assert ex_resp.status_code == 201
    exercise_id = ex_resp.json()["id"]

    # 2. Insert a WorkoutSession and a SetEntry directly via the DB
    #    (the sessions endpoint is built in a later task).
    session_id = str(uuid.uuid4())
    set_id = str(uuid.uuid4())

    with Session(db_module.engine) as db_session:
        ws = WorkoutSession(
            id=session_id,
            started_at=datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc),
        )
        db_session.add(ws)
        db_session.commit()

        se = SetEntry(
            id=set_id,
            session_id=session_id,
            exercise_id=exercise_id,
            position=1,
            weight=100.0,
            reps=5,
        )
        db_session.add(se)
        db_session.commit()

    # 3. Rename the exercise via PATCH
    patch_resp = auth_client.patch(
        f"/exercises/{exercise_id}",
        json={"name": "Deadlift Renamed"},
        headers=headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "Deadlift Renamed"

    # 4. Verify the SetEntry still exists and its weight/reps are unchanged
    with Session(db_module.engine) as db_session:
        set_entry = db_session.get(SetEntry, set_id)
        assert set_entry is not None, "SetEntry must still exist after exercise rename"
        assert set_entry.exercise_id == exercise_id, (
            "SetEntry must still reference the same exercise_id"
        )
        assert set_entry.weight == 100.0, "Weight must be unchanged after exercise rename"
        assert set_entry.reps == 5, "Reps must be unchanged after exercise rename"

        # The exercise itself must still be reachable (no cascade delete)
        exercise = db_session.get(Exercise, exercise_id)
        assert exercise is not None, "Exercise must still exist after rename"
        assert exercise.name == "Deadlift Renamed", "Exercise name must reflect the patch"
