"""Auth router: POST /auth/login."""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.auth import create_token, verify_password
from app.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    password: str


class TokenResponse(BaseModel):
    token: str


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest) -> TokenResponse:
    """Validate password and return a JWT token.

    Returns HTTP 401 if the password does not match the stored hash.
    No rate limiting or lockout is applied (single-user personal app).
    """
    settings = get_settings()
    if not verify_password(body.password, settings.APP_PASSWORD_HASH):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return TokenResponse(token=create_token())
