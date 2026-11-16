"""Exercises router: CRUD for the exercise catalog.

Endpoints
---------
GET  /exercises                 List exercises (optional ?muscle_group= filter)
POST /exercises                 Create a custom exercise (is_custom=True)
PATCH /exercises/{exercise_id}  Edit name and/or description of an exercise

All endpoints require a valid ``Authorization: Bearer <token>`` header.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.auth import require_auth
from app.db import get_session
from app.models import Exercise

router = APIRouter(prefix="/exercises", tags=["exercises"])


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class ExerciseCreate(BaseModel):
    name: str
    muscle_group: str
    description: Optional[str] = None


class ExerciseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[Exercise])
def list_exercises(
    muscle_group: Optional[str] = None,
    session: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> list[Exercise]:
    """Return all exercises, optionally filtered by *muscle_group*."""
    query = select(Exercise)
    if muscle_group:
        query = query.where(Exercise.muscle_group == muscle_group)
    return list(session.exec(query))


@router.post("", response_model=Exercise, status_code=status.HTTP_201_CREATED)
def create_exercise(
    body: ExerciseCreate,
    session: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> Exercise:
    """Create a new custom exercise (``is_custom=True``)."""
    exercise = Exercise(
        name=body.name,
        muscle_group=body.muscle_group,
        description=body.description,
        is_custom=True,
    )
    session.add(exercise)
    session.commit()
    session.refresh(exercise)
    return exercise


@router.patch("/{exercise_id}", response_model=Exercise)
def update_exercise(
    exercise_id: int,
    body: ExerciseUpdate,
    session: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> Exercise:
    """Update an exercise's name and/or description.

    Returns HTTP 404 when *exercise_id* does not exist.
    The foreign-key relationship from ``SetEntry`` is preserved — only the
    catalog row itself is edited; historical set data is untouched.
    """
    exercise = session.get(Exercise, exercise_id)
    if exercise is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exercise {exercise_id} not found",
        )
    if body.name is not None:
        exercise.name = body.name
    if body.description is not None:
        exercise.description = body.description
    session.add(exercise)
    session.commit()
    session.refresh(exercise)
    return exercise
