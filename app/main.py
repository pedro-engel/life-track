import warnings
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.exception_handlers import http_exception_handler as _default_http_handler
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.db import init_db
from app.config import get_settings, InsecureDefaultKeyWarning
from app.routers import auth as auth_router
from app.routers import exercises as exercises_router
from app.routers import templates as templates_router
from app.routers import cycle as cycle_router
from app.routers import sessions as sessions_router
from app.routers import progress as progress_router
from app.routers import bodyweight as bodyweight_router

_DEFAULT_JWT_SECRET = "test-jwt-secret"

# Path to the built frontend SPA.  Relative to this file: ../../frontend/dist
FRONTEND_DIST = str(Path(__file__).parent.parent / "frontend" / "dist")

# Known API path segments — belt-and-suspenders guard so that 404s on paths
# like /auth/unknown-route are never served the SPA shell.
_API_PREFIXES = frozenset(
    ("auth", "exercises", "templates", "cycle", "sessions", "bodyweight", "health")
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if settings.JWT_SECRET == _DEFAULT_JWT_SECRET:
        warnings.warn(
            "JWT_SECRET is set to the insecure factory default 'test-jwt-secret'. "
            "Set a strong random secret via the JWT_SECRET environment variable "
            "before exposing this service.",
            InsecureDefaultKeyWarning,
            stacklevel=1,
        )
    init_db()
    yield


app = FastAPI(title="Strength Tracker API", lifespan=lifespan)

# API routers declared before the exception handler so they always run first.
app.include_router(auth_router.router)
app.include_router(exercises_router.router)
app.include_router(templates_router.router)
app.include_router(cycle_router.router)
app.include_router(sessions_router.router)
app.include_router(progress_router.router)
app.include_router(bodyweight_router.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.exception_handler(StarletteHTTPException)
async def _spa_exception_handler(request: Request, exc: StarletteHTTPException):
    """Single-page-app serving + pass-through for all HTTP exceptions.

    Why an exception handler instead of app.mount("/", StaticFiles(...)):
    A Mount at "/" is added to app.router.routes and shadows every route
    registered *after* it (e.g. the throwaway test route in test_auth.py, and
    any future endpoint).  An exception handler fires only after the entire
    route table has been tried, so every registered route — regardless of when
    it was added — always runs and returns its real status code.

    Logic for 404s when frontend/dist exists:
    1. Real static file (assets, favicon, manifest…) → serve it via FileResponse.
    2. Known API prefix (/auth/…, /exercises/…, etc.) → pass through as JSON 404.
    3. Everything else (SPA navigation paths like /today, /log) → serve index.html.

    Non-404 exceptions (401, 422, 500, …) always pass through to the default
    FastAPI handler, so auth errors, validation errors, etc. are unaffected.
    """
    if exc.status_code == 404:
        # Only serve the SPA fallback for GET requests.
        # Non-GET requests to unknown paths (e.g. a future POST /ask before it
        # is registered) should receive a JSON 404, not the SPA HTML shell.
        if request.method != "GET":
            return await _default_http_handler(request, exc)

        dist = Path(FRONTEND_DIST)
        if dist.exists():
            rel = request.url.path.lstrip("/")
            # --- real static file? ---
            candidate = (dist / rel).resolve() if rel else dist.resolve()
            dist_resolved = dist.resolve()
            if (
                candidate.is_file()
                and candidate.is_relative_to(dist_resolved)
            ):
                return FileResponse(str(candidate))
            # --- SPA navigation fallback (belt-and-suspenders API guard) ---
            top_segment = request.url.path.lstrip("/").split("/")[0]
            if top_segment not in _API_PREFIXES:
                return FileResponse(str(dist / "index.html"))

    # All other HTTP exceptions (401, 403, 404 on API paths, 422, …) → JSON.
    return await _default_http_handler(request, exc)
