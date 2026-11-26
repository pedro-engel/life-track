"""Sessions router: idempotent sync endpoint for workout sessions and set entries.

Endpoints
---------
POST   /sessions/sync    Upsert a session and its sets by client UUID.
GET    /sessions         List all sessions, most-recent-first.
GET    /sessions/{id}    Get a single session with its sets.

All endpoints require a valid ``Authorization: Bearer <token>`` header.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlmodel import Session, select

from app.auth import require_auth
from app.db import get_session
from app.models import SetEntry, WorkoutSession

router = APIRouter(prefix="/sessions", tags=["sessions"])


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------


class SetEntryIn(BaseModel):
    id: str
    exercise_id: int
    position: int
    weight: float
    reps: int
    note: Optional[str] = None
    completed: bool = False

    @field_validator("weight")
    @classmethod
    def weight_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("weight must be >= 0")
        return v

    @field_validator("reps")
    @classmethod
    def reps_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("reps must be >= 0")
        return v


class SessionIn(BaseModel):
    id: str
    started_at: datetime
    template_id: Optional[int] = None
    finished_at: Optional[datetime] = None


class SyncRequest(BaseModel):
    session: SessionIn
    sets: list[SetEntryIn]


class SetEntryOut(BaseModel):
    id: str
    session_id: str
    exercise_id: int
    position: int
    weight: float
    reps: int
    note: Optional[str] = None
    completed: bool


class SessionResponse(BaseModel):
    id: str
    started_at: datetime
    template_id: Optional[int] = None
    finished_at: Optional[datetime] = None
    sets: list[SetEntryOut]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_response(workout_session: WorkoutSession, db: Session) -> SessionResponse:
    """Build a SessionResponse with all set entries for *workout_session*."""
    entries = list(
        db.exec(select(SetEntry).where(SetEntry.session_id == workout_session.id))
    )
    return SessionResponse(
        id=workout_session.id,
        started_at=workout_session.started_at,
        template_id=workout_session.template_id,
        finished_at=workout_session.finished_at,
        sets=[
            SetEntryOut(
                id=e.id,
                session_id=e.session_id,
                exercise_id=e.exercise_id,
                position=e.position,
                weight=e.weight,
                reps=e.reps,
                note=e.note,
                completed=e.completed,
            )
            for e in entries
        ],
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/sync", response_model=SessionResponse)
def sync_session(
    body: SyncRequest,
    db: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> SessionResponse:
    """Upsert a workout session and all its sets by client UUID."""
    # Upsert session
    workout_session = db.get(WorkoutSession, body.session.id)
    if workout_session is None:
        workout_session = WorkoutSession(
            id=body.session.id,
            started_at=body.session.started_at,
            template_id=body.session.template_id,
            finished_at=body.session.finished_at,
        )
    else:
        workout_session.started_at = body.session.started_at
        workout_session.template_id = body.session.template_id
        workout_session.finished_at = body.session.finished_at
    db.add(workout_session)
    db.flush()

    # Upsert each set entry
    for set_in in body.sets:
        entry = db.get(SetEntry, set_in.id)
        if entry is None:
            entry = SetEntry(
                id=set_in.id,
                session_id=body.session.id,
                exercise_id=set_in.exercise_id,
                position=set_in.position,
                weight=set_in.weight,
                reps=set_in.reps,
                note=set_in.note,
                completed=set_in.completed,
            )
        else:
            entry.session_id = body.session.id
            entry.exercise_id = set_in.exercise_id
            entry.position = set_in.position
            entry.weight = set_in.weight
            entry.reps = set_in.reps
            entry.note = set_in.note
            entry.completed = set_in.completed
        db.add(entry)

    db.commit()
    db.refresh(workout_session)
    return _build_response(workout_session, db)


@router.get("", response_model=list[SessionResponse])
def list_sessions(
    db: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> list[SessionResponse]:
    """Return all sessions ordered by started_at descending (most-recent-first)."""
    sessions = list(
        db.exec(select(WorkoutSession).order_by(WorkoutSession.started_at.desc()))
    )
    return [_build_response(s, db) for s in sessions]


@router.get("/{session_id}", response_model=SessionResponse)
def get_session_by_id(
    session_id: str,
    db: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> SessionResponse:
    """Return a single session with its sets; HTTP 404 if not found."""
    workout_session = db.get(WorkoutSession, session_id)
    if workout_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )
    return _build_response(workout_session, db)
