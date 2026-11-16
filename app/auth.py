"""Authentication helpers: bcrypt password hashing, JWT creation/decoding,
and the ``require_auth`` FastAPI dependency."""
from datetime import datetime, timezone, timedelta

from passlib.context import CryptContext
from fastapi import Header, HTTPException, status
import jwt

from app.config import get_settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def hash_password(pw: str) -> str:
    """Return a bcrypt hash of *pw*."""
    return _pwd_context.hash(pw)


def verify_password(pw: str, hash: str) -> bool:
    """Return True if *pw* matches the stored bcrypt *hash*."""
    return _pwd_context.verify(pw, hash)


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_token() -> str:
    """Create a signed JWT with subject ``"user"`` and a 30-day expiry."""
    settings = get_settings()
    payload = {
        "sub": "user",
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_token(tok: str) -> dict:
    """Decode and verify *tok*; raise ``jwt.InvalidTokenError`` on failure."""
    settings = get_settings()
    return jwt.decode(tok, settings.JWT_SECRET, algorithms=["HS256"])


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

def require_auth(authorization: str | None = Header(default=None)) -> str:
    """FastAPI dependency: validate ``Authorization: Bearer <token>``.

    Returns the token subject (``"user"``) on success.
    Raises HTTP 401 when the header is missing, malformed, or the token is
    invalid.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not authorization or not authorization.startswith("Bearer "):
        raise credentials_exception

    token = authorization[len("Bearer "):]
    try:
        payload = decode_token(token)
        subject: str | None = payload.get("sub")
    except jwt.InvalidTokenError:
        raise credentials_exception

    if subject is None:
        raise credentials_exception

    return subject
