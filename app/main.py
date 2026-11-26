import warnings
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
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

# API routers — declared before the static mount so they always win.
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


# Top-level path segments that belong to the API — their 404s must not be
# swallowed by the SPA fallback.
_API_PREFIXES = frozenset(
    ("auth", "exercises", "templates", "cycle", "sessions", "bodyweight", "health")
)


class _SPAStaticFiles(StaticFiles):
    """StaticFiles subclass that falls back to index.html for unknown paths.

    This enables React Router to handle client-side navigation: any path that
    does not resolve to a real file is served the SPA shell, which then renders
    the correct screen based on the URL.

    Paths whose first segment is a known API prefix are NOT caught here — their
    404s propagate to FastAPI's exception handler and return JSON, so callers
    get a proper API error rather than the SPA shell.
    """

    async def get_response(self, path: str, scope):  # type: ignore[override]
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404:
                # Don't swallow 404s for API paths — let FastAPI return JSON.
                # Use scope["path"] (the raw URL, always forward-slash) rather
                # than the OS-normalised `path` parameter which uses backslashes
                # on Windows (StaticFiles.get_path calls os.path.normpath).
                url_path: str = scope.get("path", "")
                top_segment = url_path.lstrip("/").split("/")[0]
                if top_segment in _API_PREFIXES:
                    raise
                return await super().get_response("index.html", scope)
            raise


def _mount_spa(dist_path: str | None = None) -> None:
    """Mount the built SPA at '/'.

    Safe to call multiple times — removes any existing 'spa' mount first so
    tests can remount with a stub directory.  Guards on directory existence so
    the backend still boots in dev/test when no frontend build is present.
    """
    target = Path(dist_path or FRONTEND_DIST)
    if not target.exists():
        return
    # Remove an existing spa mount (idempotent for test remounting)
    app.router.routes = [
        r for r in app.router.routes if getattr(r, "name", None) != "spa"
    ]
    app.mount("/", _SPAStaticFiles(directory=str(target), html=True), name="spa")


# Mount the built SPA at '/'.  This is a no-op when the dist directory does
# not yet exist (dev mode / CI without a frontend build).
_mount_spa()
