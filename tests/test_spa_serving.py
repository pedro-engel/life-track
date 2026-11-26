"""Tests for FastAPI serving the built React SPA.

The backend mounts frontend/dist at '/' (after all API routers) so that:
- API and /health routes still resolve normally (declared before the mount).
- Unknown paths (client-side routes like /today) fall back to index.html.
"""
import os
import pytest
from sqlmodel import SQLModel, Session, create_engine
import app.db as db_module
import app.main as main_module
from app.main import app
from app.db import get_session
from app.config import get_settings
from fastapi.testclient import TestClient


STUB_HTML = """\
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>Life Track</title></head>
  <body><div id="root"></div></body>
</html>
"""


@pytest.fixture()
def dist_client(tmp_path):
    """TestClient with a stub frontend/dist and the SPA mounted."""
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir()
    (dist_dir / "index.html").write_text(STUB_HTML, encoding="utf-8")

    # DB setup (mirrors conftest.py client_fixture)
    db_path = tmp_path / "test.db"
    os.environ["JWT_SECRET"] = "test-spa-serving-32bytes!!"
    get_settings.cache_clear()

    test_engine = create_engine(
        f"sqlite:///{db_path}", connect_args={"check_same_thread": False}
    )
    SQLModel.metadata.create_all(test_engine)

    original_engine = db_module.engine
    db_module.engine = test_engine

    def override_get_session():
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    # Mount the stub SPA (function defined in main.py)
    main_module._mount_spa(str(dist_dir))

    with TestClient(app) as client:
        yield client

    # Teardown
    app.dependency_overrides.clear()
    db_module.engine = original_engine
    test_engine.dispose()
    # Remove the spa mount so it doesn't leak into subsequent tests
    app.router.routes = [
        r for r in app.router.routes if getattr(r, "name", None) != "spa"
    ]
    os.environ.pop("JWT_SECRET", None)
    get_settings.cache_clear()


def test_root_serves_index(dist_client):
    """GET / should return 200 and serve the SPA index.html."""
    response = dist_client.get("/")
    assert response.status_code == 200
    assert '<div id="root">' in response.text


def test_health_still_ok(dist_client):
    """GET /health must still return {'status':'ok'} — not shadowed by static mount."""
    response = dist_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_unknown_client_route_falls_back(dist_client):
    """GET /today (a client-side route) must return the SPA index.html, not 404."""
    response = dist_client.get("/today")
    assert response.status_code == 200
    assert '<div id="root">' in response.text
