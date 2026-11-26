"""Body weight router: log and list body weight entries.

Endpoints
---------
POST   /bodyweight    Log a new body weight entry (weight, recorded_at optional).
GET    /bodyweight    List all entries ordered by recorded_at ascending (oldest first).

All endpoints require a valid ``Authorization: Bearer <token>`` header.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator
from sqlmodel import Session, select

from app.auth import require_auth
from app.db import get_session
from app.models import BodyWeightEntry

router = APIRouter(prefix="/bodyweight", tags=["bodyweight"])


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------


class BodyWeightIn(BaseModel):
    weight: float
    recorded_at: Optional[datetime] = None

    @field_validator("weight")
    @classmethod
    def weight_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("weight must be > 0")
        return v


class BodyWeightOut(BaseModel):
    id: int
    recorded_at: datetime
    weight: float


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=BodyWeightOut)
def log_bodyweight(
    body: BodyWeightIn,
    db: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> BodyWeightOut:
    """Create a new body weight entry. recorded_at defaults to now (UTC)."""
    recorded_at = body.recorded_at if body.recorded_at is not None else datetime.now(timezone.utc)
    entry = BodyWeightEntry(weight=body.weight, recorded_at=recorded_at)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return BodyWeightOut(id=entry.id, recorded_at=entry.recorded_at, weight=entry.weight)


@router.get("", response_model=list[BodyWeightOut])
def list_bodyweight(
    db: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> list[BodyWeightOut]:
    """Return all body weight entries ordered by recorded_at ascending (oldest first)."""
    entries = list(
        db.exec(select(BodyWeightEntry).order_by(BodyWeightEntry.recorded_at.asc()))
    )
    return [
        BodyWeightOut(id=e.id, recorded_at=e.recorded_at, weight=e.weight)
        for e in entries
    ]
