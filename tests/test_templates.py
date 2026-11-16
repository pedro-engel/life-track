"""Tests for Task 5: Workout templates (CRUD with ordered exercises)."""
import os

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine

import app.db as db_module
from app.db import get_session
from app.main import app
from app.auth import hash_password
from app.config import get_settings

KNOWN_PASSWORD = "my_secure_password_templates!!"
KNOWN_SECRET = "test-jwt-secret-for-templates!!X"  # 32 bytes exactly


@pytest.fixture(name="auth_client")
def auth_client_fixture(tmp_path):
    """TestClient backed by a fresh per-test SQLite DB with valid credentials."""
    db_path = tmp_path / "tmpl_test.db"
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


def create_exercises(client: TestClient, headers: dict) -> list[int]:
    """Create three custom exercises and return their IDs."""
    ids = []
    for i, (name, mg) in enumerate([
        ("Bench Press", "chest"),
        ("Squat", "legs"),
        ("Deadlift", "back"),
    ]):
        resp = client.post(
            "/exercises",
            json={"name": name, "muscle_group": mg},
            headers=headers,
        )
        assert resp.status_code == 201, f"Failed to create exercise {name}: {resp.text}"
        ids.append(resp.json()["id"])
    return ids


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_create_template_preserves_exercise_order(auth_client):
    """POST /templates with exercise_ids preserves list order via position."""
    token = get_token(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    ex_ids = create_exercises(auth_client, headers)

    # Submit in a specific order: 3rd, 1st, 2nd
    ordered_ids = [ex_ids[2], ex_ids[0], ex_ids[1]]

    resp = auth_client.post(
        "/templates",
        json={"name": "Peito", "exercise_ids": ordered_ids},
        headers=headers,
    )
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["name"] == "Peito"
    assert "id" in data

    # Verify the exercises come back in the correct order
    returned_ids = [ex["id"] for ex in data["exercises"]]
    assert returned_ids == ordered_ids, (
        f"Exercise order not preserved. Expected {ordered_ids}, got {returned_ids}"
    )


def test_get_template_returns_ordered_exercises(auth_client):
    """GET /templates/{id} returns the template with full exercise objects in position order."""
    token = get_token(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    ex_ids = create_exercises(auth_client, headers)
    ordered_ids = [ex_ids[1], ex_ids[2], ex_ids[0]]  # specific order

    create_resp = auth_client.post(
        "/templates",
        json={"name": "Full Body", "exercise_ids": ordered_ids},
        headers=headers,
    )
    assert create_resp.status_code == 201
    template_id = create_resp.json()["id"]

    # GET single template
    get_resp = auth_client.get(f"/templates/{template_id}", headers=headers)
    assert get_resp.status_code == 200, f"Expected 200, got {get_resp.status_code}: {get_resp.text}"
    data = get_resp.json()
    assert data["id"] == template_id
    assert data["name"] == "Full Body"
    assert len(data["exercises"]) == 3

    # Verify full exercise objects (not just IDs) and correct order
    returned_ids = [ex["id"] for ex in data["exercises"]]
    assert returned_ids == ordered_ids, (
        f"GET returned wrong order. Expected {ordered_ids}, got {returned_ids}"
    )

    # Each exercise should have full object fields
    first_ex = data["exercises"][0]
    assert "name" in first_ex
    assert "muscle_group" in first_ex
    assert "is_custom" in first_ex

    # GET list should also return templates and preserve exercise order there too
    list_resp = auth_client.get("/templates", headers=headers)
    assert list_resp.status_code == 200
    templates = list_resp.json()
    matching = [t for t in templates if t["id"] == template_id]
    assert matching, "Template not found in list endpoint"
    list_returned_ids = [ex["id"] for ex in matching[0]["exercises"]]
    assert list_returned_ids == ordered_ids, (
        f"List endpoint returned wrong exercise order. Expected {ordered_ids}, got {list_returned_ids}"
    )


def test_patch_replaces_exercise_list(auth_client):
    """PATCH /templates/{id} can rename and/or replace the ordered exercise list."""
    token = get_token(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    ex_ids = create_exercises(auth_client, headers)

    create_resp = auth_client.post(
        "/templates",
        json={"name": "Original", "exercise_ids": ex_ids},
        headers=headers,
    )
    assert create_resp.status_code == 201
    template_id = create_resp.json()["id"]

    # Patch: rename and reverse the exercise order
    reversed_ids = list(reversed(ex_ids))
    patch_resp = auth_client.patch(
        f"/templates/{template_id}",
        json={"name": "Renamed", "exercise_ids": reversed_ids},
        headers=headers,
    )
    assert patch_resp.status_code == 200, f"Expected 200, got {patch_resp.status_code}: {patch_resp.text}"
    data = patch_resp.json()
    assert data["name"] == "Renamed"
    returned_ids = [ex["id"] for ex in data["exercises"]]
    assert returned_ids == reversed_ids, (
        f"PATCH did not replace list. Expected {reversed_ids}, got {returned_ids}"
    )

    # Verify GET reflects the change
    get_resp = auth_client.get(f"/templates/{template_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Renamed"
    assert [ex["id"] for ex in get_resp.json()["exercises"]] == reversed_ids

    # Patch: rename only (no exercise_ids)
    rename_resp = auth_client.patch(
        f"/templates/{template_id}",
        json={"name": "Renamed Again"},
        headers=headers,
    )
    assert rename_resp.status_code == 200
    assert rename_resp.json()["name"] == "Renamed Again"
    # Exercises should be unchanged
    assert [ex["id"] for ex in rename_resp.json()["exercises"]] == reversed_ids


def test_delete_template(auth_client):
    """DELETE /templates/{id} removes the template; subsequent GET returns 404."""
    token = get_token(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    ex_ids = create_exercises(auth_client, headers)

    create_resp = auth_client.post(
        "/templates",
        json={"name": "To Delete", "exercise_ids": ex_ids[:2]},
        headers=headers,
    )
    assert create_resp.status_code == 201
    template_id = create_resp.json()["id"]

    # DELETE
    del_resp = auth_client.delete(f"/templates/{template_id}", headers=headers)
    assert del_resp.status_code == 204, f"Expected 204, got {del_resp.status_code}: {del_resp.text}"

    # GET should now return 404
    get_resp = auth_client.get(f"/templates/{template_id}", headers=headers)
    assert get_resp.status_code == 404

    # DELETE again returns 404
    del_again = auth_client.delete(f"/templates/{template_id}", headers=headers)
    assert del_again.status_code == 404


def test_templates_require_auth(auth_client):
    """All template endpoints return 401 when no Authorization header is provided."""
    assert auth_client.get("/templates").status_code == 401
    assert auth_client.post(
        "/templates", json={"name": "X", "exercise_ids": []}
    ).status_code == 401
    assert auth_client.get("/templates/1").status_code == 401
    assert auth_client.patch("/templates/1", json={"name": "Y"}).status_code == 401
    assert auth_client.delete("/templates/1").status_code == 401


def test_invalid_exercise_id_returns_422(auth_client):
    """POST and PATCH with non-existent exercise ids return 422; no rows are created."""
    from app.models import WorkoutTemplate, TemplateExercise
    from sqlmodel import Session, select

    token = get_token(auth_client)
    headers = {"Authorization": f"Bearer {token}"}

    ex_ids = create_exercises(auth_client, headers)

    # POST with a non-existent exercise id
    bad_ids = [ex_ids[0], 999999]
    resp = auth_client.post(
        "/templates",
        json={"name": "Bad Template", "exercise_ids": bad_ids},
        headers=headers,
    )
    assert resp.status_code == 422, f"Expected 422, got {resp.status_code}: {resp.text}"
    assert "999999" in resp.text, "Response should name the missing id"

    # Assert no template or TemplateExercise row was created
    with Session(db_module.engine) as db_session:
        templates = list(db_session.exec(select(WorkoutTemplate)))
        assert len(templates) == 0, f"No template should have been created; found {templates}"
        te_rows = list(db_session.exec(select(TemplateExercise)))
        assert len(te_rows) == 0, f"No TemplateExercise rows should exist; found {te_rows}"

    # Create a valid template first, then PATCH with invalid id
    create_resp = auth_client.post(
        "/templates",
        json={"name": "Valid", "exercise_ids": [ex_ids[0]]},
        headers=headers,
    )
    assert create_resp.status_code == 201
    template_id = create_resp.json()["id"]

    patch_resp = auth_client.patch(
        f"/templates/{template_id}",
        json={"exercise_ids": [ex_ids[0], 999999]},
        headers=headers,
    )
    assert patch_resp.status_code == 422, f"Expected 422, got {patch_resp.status_code}: {patch_resp.text}"

    # Existing template exercises must be unchanged
    get_resp = auth_client.get(f"/templates/{template_id}", headers=headers)
    assert get_resp.status_code == 200
    assert [ex["id"] for ex in get_resp.json()["exercises"]] == [ex_ids[0]]
