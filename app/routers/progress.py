"""Progress router: reference-data endpoints for the live-workout screen.

Endpoints
---------
GET /exercises/{exercise_id}/last-set?position=N
    Return what the user did for set N of *exercise_id* in the most recent
    prior session that contained that exercise.  Returns JSON null (HTTP 200)
    when the exercise has never been logged.

This module is shared with Task 10, which will add a ``/progress`` route here.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session

from app.auth import require_auth
from app.db import get_session
from app.models import WorkoutSession
from app.progress_logic import last_set_for

router = APIRouter(prefix="/exercises", tags=["progress"])


# ---------------------------------------------------------------------------
# Response schema
# ---------------------------------------------------------------------------


class LastSetResponse(BaseModel):
    weight: float
    reps: int
    note: Optional[str]
    session_date: datetime


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/{exercise_id}/last-set", response_model=Optional[LastSetResponse])
def get_last_set(
    exercise_id: int,
    position: int,
    db: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> Optional[LastSetResponse]:
    """Return the last-time reference for *exercise_id* at set index *position*.

    HTTP 200 with JSON null when the exercise has never been logged — this is
    a "no reference yet" signal, not an error.
    """
    entry = last_set_for(db, exercise_id, position)
    if entry is None:
        return None

    session = db.get(WorkoutSession, entry.session_id)
    return LastSetResponse(
        weight=entry.weight,
        reps=entry.reps,
        note=entry.note,
        session_date=session.started_at,
    )
