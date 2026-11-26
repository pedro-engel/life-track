"""Tests for FastAPI serving the built React SPA.

The backend uses a 404 exception handler (not a greedy Mount at '/') so that:
- Every registered API/app route always runs and returns its real status code,
  regardless of when the route was added relative to module load.
- Real static assets in frontend/dist are served via FileResponse.
- Genuinely unmatched navigation paths (e.g. /today) fall back to index.html.
- Known API paths (e.g. /auth/unknown) return JSON 404, not the SPA shell.
"""
import os
import pytest
from fastapi import Depends
from sqlmodel import SQLModel, Session, create_engine

import app.db as db_module
import app.main as main_module
from app.main import app
from app.auth import require_auth
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

# ---------------------------------------------------------------------------
# Throwaway protected route at a path NOT covered by _API_PREFIXES.
# Registered once at module load — the exception-handler approach means this
# route is always reachable regardless of when it is registered vs the handler.
# ---------------------------------------------------------------------------
@app.get("/zzz-protected")
def _zzz_protected(sub: str = Depends(require_auth)):
    return {"subject": sub}


@pytest.fixture()
def dist_client(tmp_path, monkeypatch):
    """TestClient whose FRONTEND_DIST points at a stub dist directory."""
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir()
    (dist_dir / "index.html").write_text(STUB_HTML, encoding="utf-8")

    # Patch FRONTEND_DIST so the exception handler reads from our stub dir.
    monkeypatch.setattr(main_module, "FRONTEND_DIST", str(dist_dir))

    # DB setup (mirrors conftest.py client_fixture)
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("JWT_SECRET", "test-spa-serving-32bytes!!")
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

    with TestClient(app) as client:
        yield client

    # Teardown — no mount to remove; just clean up DB state.
    app.dependency_overrides.clear()
    db_module.engine = original_engine
    test_engine.dispose()
    get_settings.cache_clear()


def test_root_serves_index(dist_client):
    """GET / should return 200 and serve the SPA index.html."""
    response = dist_client.get("/")
    assert response.status_code == 200
    assert '<div id="root">' in response.text


def test_health_still_ok(dist_client):
    """GET /health must still return {'status':'ok'} — not shadowed by SPA handler."""
    response = dist_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_unknown_client_route_falls_back(dist_client):
    """GET /today (a client-side route) must return the SPA index.html, not 404."""
    response = dist_client.get("/today")
    assert response.status_code == 200
    assert '<div id="root">' in response.text


def test_api_404_is_not_swallowed(dist_client):
    """API 404s must not be replaced by the SPA index.html.

    /auth/does-not-exist-at-all matches no registered route; the SPA fallback
    must let it propagate as a JSON 404, not silently serve the SPA shell.
    """
    response = dist_client.get("/auth/does-not-exist-at-all")
    assert response.headers.get("content-type", "").startswith("application/json")
    assert '<div id="root">' not in response.text


def test_protected_nonprefix_route_returns_401_not_spa(dist_client):
    """A protected route outside _API_PREFIXES must return 401, not index.html.

    Regression for the greedy-mount bug: when frontend/dist exists, routes
    added after app.main loads (e.g. test helpers, Phase-2 /ask endpoint) must
    still run and return their real status codes — the SPA fallback must only
    fire for paths with *no* matching route.
    """
    # /zzz-protected is registered above at module level and uses require_auth.
    # Its prefix "zzz" is NOT in _API_PREFIXES, so without the exception-handler
    # approach the old Mount-at-'/' would have served index.html instead.
    response = dist_client.get("/zzz-protected")
    assert response.status_code == 401
    assert '<div id="root">' not in response.text


def test_non_get_unregistered_path_returns_json_404(dist_client):
    """A POST (or other non-GET) to an unregistered path must return JSON 404,
    not the SPA index.html.

    This ensures that future endpoints like POST /ask don't silently receive
    the HTML shell before the route is registered.
    """
    response = dist_client.post("/totally-unknown-path")
    assert response.status_code == 404
    assert response.headers.get("content-type", "").startswith("application/json")
    assert '<div id="root">' not in response.text
