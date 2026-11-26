"""Progress router: reference-data endpoints for the live-workout screen.

Endpoints
---------
GET /exercises/{exercise_id}/last-set?position=N
    Return what the user did for set N of *exercise_id* in the most recent
    prior session that contained that exercise.  Returns JSON null (HTTP 200)
    when the exercise has never been logged.

GET /exercises/{exercise_id}/progress
    Return a chronological time series of per-session aggregates for
    *exercise_id*: [{date, top_weight, total_reps}, ...], one point per
    WorkoutSession that logged the exercise.  Returns [] (HTTP 200) when the
    exercise has never been logged.
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
from app.progress_logic import last_set_for, progress_series_for

router = APIRouter(prefix="/exercises", tags=["progress"])


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class LastSetResponse(BaseModel):
    weight: float
    reps: int
    note: Optional[str]
    session_date: datetime


class ProgressPoint(BaseModel):
    date: datetime
    top_weight: float
    total_reps: int


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


@router.get("/{exercise_id}/progress", response_model=list[ProgressPoint])
def get_exercise_progress(
    exercise_id: int,
    db: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> list[ProgressPoint]:
    """Return a chronological progress series for *exercise_id*.

    Each element is one WorkoutSession that logged the exercise, containing the
    maximum weight lifted and the total reps performed.  Returns an empty list
    when the exercise has never been logged — this is a "no history yet"
    signal, not an error.
    """
    series = progress_series_for(db, exercise_id)
    return [
        ProgressPoint(date=point.date, top_weight=point.top_weight, total_reps=point.total_reps)
        for point in series
    ]
