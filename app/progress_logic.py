"""Pure-ish query logic for the "última vez" (last-time) reference lookup and
the per-exercise progress series.

``last_set_for`` finds the most recent WorkoutSession (by ``started_at``) in
which *exercise_id* was logged, then returns:
- the SetEntry at ``position`` if it exists in that session;
- the SetEntry at ``max(position) ≤ N`` (the session's last set) as a
  fall-back when fewer sets were performed than the requested index;
- ``None`` when the exercise has never been logged.

``progress_series_for`` returns a time-ordered list of per-session aggregates
(top_weight, total_reps) for the given exercise.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func
from sqlmodel import Session, select

from app.models import SetEntry, WorkoutSession


def last_set_for(
    db: Session,
    exercise_id: int,
    position: int,
    exclude_session_id: str | None = None,
) -> SetEntry | None:
    """Return the reference set for *exercise_id* at *position*.

    Args:
        db: An open SQLModel/SQLAlchemy Session.
        exercise_id: The exercise to look up.
        position: The set index (0-based, as stored in SetEntry.position).
        exclude_session_id: When provided, skip this session id when selecting
            the most-recent prior session.  Callers pass the id of the
            in-progress session so it isn't echoed back as the reference.

    Returns:
        The matching SetEntry from the most recent prior session, or ``None``
        if the exercise has never been logged.
    """
    # Step 1 — collect distinct session IDs that contain this exercise
    session_ids = db.exec(
        select(SetEntry.session_id)
        .where(SetEntry.exercise_id == exercise_id)
        .distinct()
    ).all()

    if not session_ids:
        return None

    # Step 2 — find the most recent WorkoutSession among those
    stmt = (
        select(WorkoutSession)
        .where(WorkoutSession.id.in_(session_ids))
        .order_by(WorkoutSession.started_at.desc())
        .limit(1)
    )
    if exclude_session_id is not None:
        stmt = stmt.where(WorkoutSession.id != exclude_session_id)

    prior_session = db.exec(stmt).first()

    if prior_session is None:
        return None

    # Step 3 — exact match: set at the requested position
    exact = db.exec(
        select(SetEntry)
        .where(SetEntry.session_id == prior_session.id)
        .where(SetEntry.exercise_id == exercise_id)
        .where(SetEntry.position == position)
    ).first()

    if exact is not None:
        return exact

    # Step 4 — fall back: max position ≤ N (last set in that session)
    fallback = db.exec(
        select(SetEntry)
        .where(SetEntry.session_id == prior_session.id)
        .where(SetEntry.exercise_id == exercise_id)
        .where(SetEntry.position <= position)
        .order_by(SetEntry.position.desc())
        .limit(1)
    ).first()

    return fallback


# ---------------------------------------------------------------------------
# Progress series
# ---------------------------------------------------------------------------


@dataclass
class ProgressRow:
    """One data point in a per-exercise progress series."""

    date: datetime
    top_weight: float
    total_reps: int


def progress_series_for(db: Session, exercise_id: int) -> list[ProgressRow]:
    """Return a chronological series of per-session aggregates for *exercise_id*.

    Each element represents one WorkoutSession that logged the exercise:
    - ``date``        — the session's ``started_at`` timestamp
    - ``top_weight``  — the MAX weight among the exercise's sets in that session
    - ``total_reps``  — the SUM of reps across the exercise's sets in that session

    Returns an empty list when the exercise has never been logged.
    """
    # Aggregate over SetEntry joined to WorkoutSession, grouping by session
    rows = db.exec(
        select(
            WorkoutSession.started_at,
            func.max(SetEntry.weight).label("top_weight"),
            func.sum(SetEntry.reps).label("total_reps"),
        )
        .join(WorkoutSession, SetEntry.session_id == WorkoutSession.id)
        .where(SetEntry.exercise_id == exercise_id)
        .group_by(WorkoutSession.id)
        .order_by(WorkoutSession.started_at.asc())
    ).all()

    return [
        ProgressRow(date=started_at, top_weight=top_weight, total_reps=total_reps)
        for started_at, top_weight, total_reps in rows
    ]
