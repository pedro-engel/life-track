"""Templates router: CRUD for workout templates with ordered exercises.

Endpoints
---------
POST   /templates                Create a template with an ordered exercise list
GET    /templates                List all templates with their ordered exercises
GET    /templates/{template_id}  Get a single template with ordered exercises
PATCH  /templates/{template_id}  Rename and/or replace the exercise list
DELETE /templates/{template_id}  Remove a template and its exercises

All endpoints require a valid ``Authorization: Bearer <token>`` header.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.auth import require_auth
from app.db import get_session
from app.models import Exercise, TemplateExercise, WorkoutTemplate

router = APIRouter(prefix="/templates", tags=["templates"])


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class TemplateCreate(BaseModel):
    name: str
    exercise_ids: list[int]


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    exercise_ids: Optional[list[int]] = None


class TemplateResponse(BaseModel):
    id: int
    name: str
    exercises: list[Exercise]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_response(template: WorkoutTemplate, session: Session) -> TemplateResponse:
    """Build a TemplateResponse with ordered exercises for *template*."""
    rows = list(
        session.exec(
            select(TemplateExercise)
            .where(TemplateExercise.template_id == template.id)
            .order_by(TemplateExercise.position)
        )
    )
    exercises: list[Exercise] = []
    for row in rows:
        ex = session.get(Exercise, row.exercise_id)
        if ex is not None:
            exercises.append(ex)
    return TemplateResponse(id=template.id, name=template.name, exercises=exercises)


def _replace_exercises(
    template_id: int, exercise_ids: list[int], session: Session
) -> None:
    """Delete existing TemplateExercise rows for *template_id* and re-insert."""
    existing = list(
        session.exec(
            select(TemplateExercise).where(TemplateExercise.template_id == template_id)
        )
    )
    for row in existing:
        session.delete(row)
    session.flush()

    for position, ex_id in enumerate(exercise_ids):
        session.add(
            TemplateExercise(
                template_id=template_id,
                exercise_id=ex_id,
                position=position,
            )
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    body: TemplateCreate,
    session: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> TemplateResponse:
    """Create a new workout template with an ordered list of exercises."""
    template = WorkoutTemplate(name=body.name)
    session.add(template)
    session.commit()
    session.refresh(template)

    _replace_exercises(template.id, body.exercise_ids, session)
    session.commit()

    return _build_response(template, session)


@router.get("", response_model=list[TemplateResponse])
def list_templates(
    session: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> list[TemplateResponse]:
    """Return all workout templates with their ordered exercises."""
    templates = list(session.exec(select(WorkoutTemplate)))
    return [_build_response(t, session) for t in templates]


@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(
    template_id: int,
    session: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> TemplateResponse:
    """Return a single template with its ordered exercises.

    Returns HTTP 404 when *template_id* does not exist.
    """
    template = session.get(WorkoutTemplate, template_id)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found",
        )
    return _build_response(template, session)


@router.patch("/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: int,
    body: TemplateUpdate,
    session: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> TemplateResponse:
    """Rename a template and/or replace its ordered exercise list.

    Returns HTTP 404 when *template_id* does not exist.
    """
    template = session.get(WorkoutTemplate, template_id)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found",
        )
    if body.name is not None:
        template.name = body.name
        session.add(template)
    if body.exercise_ids is not None:
        _replace_exercises(template_id, body.exercise_ids, session)
    session.commit()
    session.refresh(template)
    return _build_response(template, session)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: int,
    session: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> None:
    """Delete a template and all its associated TemplateExercise rows.

    Returns HTTP 404 when *template_id* does not exist.
    """
    template = session.get(WorkoutTemplate, template_id)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found",
        )
    # Remove associated exercise rows first
    existing = list(
        session.exec(
            select(TemplateExercise).where(TemplateExercise.template_id == template_id)
        )
    )
    for row in existing:
        session.delete(row)
    session.delete(template)
    session.commit()
