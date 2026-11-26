"""Pure-ish query logic for the "última vez" (last-time) reference lookup.

``last_set_for`` finds the most recent WorkoutSession (by ``started_at``) in
which *exercise_id* was logged, then returns:
- the SetEntry at ``position`` if it exists in that session;
- the SetEntry at ``max(position) ≤ N`` (the session's last set) as a
  fall-back when fewer sets were performed than the requested index;
- ``None`` when the exercise has never been logged.
"""
from __future__ import annotations

from sqlmodel import Session, select

from app.models import SetEntry, WorkoutSession


def last_set_for(db: Session, exercise_id: int, position: int) -> SetEntry | None:
    """Return the reference set for *exercise_id* at *position*.

    Args:
        db: An open SQLModel/SQLAlchemy Session.
        exercise_id: The exercise to look up.
        position: The set index (0-based, as stored in SetEntry.position).

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
    prior_session = db.exec(
        select(WorkoutSession)
        .where(WorkoutSession.id.in_(session_ids))
        .order_by(WorkoutSession.started_at.desc())
        .limit(1)
    ).first()

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
