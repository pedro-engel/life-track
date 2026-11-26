"""Tests for Task 6: Routine cycle (define + pointer advance logic)."""
import os

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine

import app.db as db_module
from app.db import get_session
from app.main import app
from app.auth import hash_password
from app.config import get_settings
from app.cycle_logic import next_pointer

KNOWN_PASSWORD = "my_secure_password_cycle!!!1234"
KNOWN_SECRET = "test-jwt-secret-for-cycle-tests!!"  # 32+ bytes


# ---------------------------------------------------------------------------
# Pure function tests
# ---------------------------------------------------------------------------

def test_completing_current_advances_by_one():
    """Completing the current step (pointer==position) moves pointer by 1."""
    assert next_pointer(current=1, completed_position=1, length=5) == 2


def test_completing_out_of_order_moves_to_after_that_step():
    """Completing an out-of-order step moves pointer to just after that step."""
    assert next_pointer(current=0, completed_position=3, length=5) == 4


def test_advancing_past_last_wraps_to_zero():
    """Completing the last step wraps the pointer back to 0."""
    assert next_pointer(current=4, completed_position=4, length=5) == 0


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(name="auth_client")
def auth_client_fixture(tmp_path):
    """TestClient backed by a fresh per-test SQLite DB with valid credentials."""
    db_path = tmp_path / "cycle_test.db"
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


def create_template(client: TestClient, headers: dict, name: str = "Workout A") -> int:
    """Create an exercise and a template, return the template id."""
    ex_resp = client.post(
        "/exercises",
        json={"name": "Push Up", "muscle_group": "chest"},
        headers=headers,
    )
    assert ex_resp.status_code == 201
    ex_id = ex_resp.json()["id"]

    tmpl_resp = client.post(
        "/templates",
        json={"name": name, "exercise_ids": [ex_id]},
        headers=headers,
    )
    assert tmpl_resp.status_code == 201
    return tmpl_resp.json()["id"]


# ---------------------------------------------------------------------------
# Router tests
# ---------------------------------------------------------------------------


def test_put_cycle_resets_pointer(auth_client):
    """PUT /cycle with steps replaces the cycle and resets pointer to 0."""
    token = get_token(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    tmpl_id = create_template(auth_client, headers)

    resp = auth_client.put(
        "/cycle",
        json={"steps": [
            {"kind": "template", "template_id": tmpl_id},
            {"kind": "run"},
            {"kind": "rest"},
        ]},
        headers=headers,
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["pointer"] == 0
    assert len(data["steps"]) == 3
    assert data["steps"][0]["kind"] == "template"
    assert data["steps"][0]["template_id"] == tmpl_id
    assert data["next"]["position"] == 0

    # Advance the pointer
    auth_client.post(
        "/cycle/advance",
        json={"completed_step_position": 0},
        headers=headers,
    )

    # PUT again — pointer must be reset to 0
    resp2 = auth_client.put(
        "/cycle",
        json={"steps": [
            {"kind": "run"},
            {"kind": "rest"},
        ]},
        headers=headers,
    )
    assert resp2.status_code == 200
    assert resp2.json()["pointer"] == 0


def test_get_cycle_returns_next_step(auth_client):
    """GET /cycle returns steps, current pointer, and the resolved next step."""
    token = get_token(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    tmpl_id = create_template(auth_client, headers)

    auth_client.put(
        "/cycle",
        json={"steps": [
            {"kind": "template", "template_id": tmpl_id},
            {"kind": "run"},
            {"kind": "rest"},
        ]},
        headers=headers,
    )

    resp = auth_client.get("/cycle", headers=headers)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["pointer"] == 0
    assert len(data["steps"]) == 3
    assert data["next"] is not None
    assert data["next"]["position"] == 0
    assert data["next"]["kind"] == "template"

    # Advance pointer to 1 and verify GET returns updated next
    auth_client.post(
        "/cycle/advance",
        json={"completed_step_position": 0},
        headers=headers,
    )

    resp2 = auth_client.get("/cycle", headers=headers)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["pointer"] == 1
    assert data2["next"]["position"] == 1
    assert data2["next"]["kind"] == "run"


def test_cycle_requires_auth(auth_client):
    """All cycle endpoints return 401 without Authorization header."""
    assert auth_client.get("/cycle").status_code == 401
    assert auth_client.put("/cycle", json={"steps": []}).status_code == 401
    assert auth_client.post(
        "/cycle/advance", json={"completed_step_position": 0}
    ).status_code == 401


def test_put_cycle_validates_template_id(auth_client):
    """PUT /cycle with kind='template' and non-existent template_id returns 422."""
    token = get_token(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = auth_client.put(
        "/cycle",
        json={"steps": [{"kind": "template", "template_id": 99999}]},
        headers=headers,
    )
    assert resp.status_code == 422, f"Expected 422, got {resp.status_code}: {resp.text}"


def test_advance_cycle_updates_pointer(auth_client):
    """POST /cycle/advance applies next_pointer and returns the new pointer value."""
    token = get_token(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    # Set up a 3-step cycle
    auth_client.put(
        "/cycle",
        json={"steps": [
            {"kind": "run"},
            {"kind": "rest"},
            {"kind": "run"},
        ]},
        headers=headers,
    )

    resp = auth_client.post(
        "/cycle/advance",
        json={"completed_step_position": 0},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["pointer"] == 1

    # Completing step at position 2 (last step) should wrap to 0
    resp2 = auth_client.post(
        "/cycle/advance",
        json={"completed_step_position": 2},
        headers=headers,
    )
    assert resp2.status_code == 200
    assert resp2.json()["pointer"] == 0


# ---------------------------------------------------------------------------
# Tests for review findings (task-6 fix)
# ---------------------------------------------------------------------------


def test_put_cycle_rejects_invalid_kind(auth_client):
    """PUT /cycle with an unrecognised kind returns 422."""
    token = get_token(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = auth_client.put(
        "/cycle",
        json={"steps": [{"kind": "workout"}]},
        headers=headers,
    )
    assert resp.status_code == 422, f"Expected 422, got {resp.status_code}: {resp.text}"


def test_put_cycle_rejects_template_id_on_non_template_step(auth_client):
    """PUT /cycle with kind='run' and a non-null template_id returns 422."""
    token = get_token(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = auth_client.put(
        "/cycle",
        json={"steps": [{"kind": "run", "template_id": 42}]},
        headers=headers,
    )
    assert resp.status_code == 422, f"Expected 422, got {resp.status_code}: {resp.text}"


def test_advance_rejects_out_of_range_position(auth_client):
    """POST /cycle/advance returns 422 for positions outside [0, len-1]."""
    token = get_token(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    # Set up a 3-step cycle
    auth_client.put(
        "/cycle",
        json={"steps": [
            {"kind": "run"},
            {"kind": "rest"},
            {"kind": "run"},
        ]},
        headers=headers,
    )

    # Negative position
    resp_neg = auth_client.post(
        "/cycle/advance",
        json={"completed_step_position": -1},
        headers=headers,
    )
    assert resp_neg.status_code == 422, (
        f"Expected 422 for position=-1, got {resp_neg.status_code}: {resp_neg.text}"
    )

    # Position >= len (cycle has 3 steps, so position 3 is out of range)
    resp_over = auth_client.post(
        "/cycle/advance",
        json={"completed_step_position": 99},
        headers=headers,
    )
    assert resp_over.status_code == 422, (
        f"Expected 422 for position=99, got {resp_over.status_code}: {resp_over.text}"
    )
