"""Cycle router: define and advance the training cycle.

Endpoints
---------
PUT   /cycle          Replace the cycle with a new ordered step list; reset pointer.
GET   /cycle          Return current steps, pointer, and the resolved next step.
POST  /cycle/advance  Advance the pointer based on a completed step position.

All endpoints require a valid ``Authorization: Bearer <token>`` header.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.auth import require_auth
from app.cycle_logic import next_pointer
from app.db import get_session
from app.models import CycleState, CycleStep, WorkoutTemplate

router = APIRouter(prefix="/cycle", tags=["cycle"])

_SINGLETON_ID = 1


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------


class StepInput(BaseModel):
    kind: str  # "template" | "run" | "rest"
    template_id: Optional[int] = None


class CyclePutRequest(BaseModel):
    steps: list[StepInput]


class StepResponse(BaseModel):
    position: int
    kind: str
    template_id: Optional[int] = None


class CycleGetResponse(BaseModel):
    steps: list[StepResponse]
    pointer: int
    next: Optional[StepResponse] = None


class AdvanceRequest(BaseModel):
    completed_step_position: int


class AdvanceResponse(BaseModel):
    pointer: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_or_create_state(session: Session) -> CycleState:
    """Return the singleton CycleState row, creating it (pointer=0) if absent."""
    state = session.get(CycleState, _SINGLETON_ID)
    if state is None:
        state = CycleState(id=_SINGLETON_ID, pointer=0)
        session.add(state)
        session.flush()
    return state


def _validate_template_id(template_id: int, session: Session) -> None:
    """Raise HTTP 422 if *template_id* does not resolve to a WorkoutTemplate row."""
    if session.get(WorkoutTemplate, template_id) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Template id not found: {template_id}",
        )


def _load_steps(session: Session) -> list[CycleStep]:
    """Return all CycleStep rows ordered by position."""
    return list(
        session.exec(select(CycleStep).order_by(CycleStep.position))
    )


def _to_response(step: CycleStep) -> StepResponse:
    return StepResponse(
        position=step.position,
        kind=step.kind,
        template_id=step.template_id,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.put("", response_model=CycleGetResponse, status_code=status.HTTP_200_OK)
def put_cycle(
    body: CyclePutRequest,
    session: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> CycleGetResponse:
    """Replace the cycle with a new ordered step list and reset the pointer to 0."""
    # Validate inputs before mutating anything
    for step in body.steps:
        if step.kind == "template":
            if step.template_id is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Steps of kind 'template' must include a template_id",
                )
            _validate_template_id(step.template_id, session)

    # Delete existing steps
    for existing in _load_steps(session):
        session.delete(existing)
    session.flush()

    # Insert new steps in order
    new_rows: list[CycleStep] = []
    for position, step in enumerate(body.steps):
        cs = CycleStep(
            position=position,
            kind=step.kind,
            template_id=step.template_id,
        )
        session.add(cs)
        new_rows.append(cs)

    # Reset singleton pointer
    state = _get_or_create_state(session)
    state.pointer = 0
    session.add(state)

    session.commit()

    step_responses = [_to_response(s) for s in new_rows]
    next_step = step_responses[0] if step_responses else None

    return CycleGetResponse(
        steps=step_responses,
        pointer=0,
        next=next_step,
    )


@router.get("", response_model=CycleGetResponse)
def get_cycle(
    session: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> CycleGetResponse:
    """Return the cycle steps, current pointer, and the resolved next step."""
    steps = _load_steps(session)
    state = _get_or_create_state(session)
    session.commit()  # persist state row if newly created

    step_responses = [_to_response(s) for s in steps]

    next_step: Optional[StepResponse] = None
    if step_responses:
        next_step = step_responses[state.pointer % len(step_responses)]

    return CycleGetResponse(
        steps=step_responses,
        pointer=state.pointer,
        next=next_step,
    )


@router.post("/advance", response_model=AdvanceResponse, status_code=status.HTTP_200_OK)
def advance_cycle(
    body: AdvanceRequest,
    session: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> AdvanceResponse:
    """Advance the cycle pointer based on the position of the completed step."""
    steps = _load_steps(session)
    if not steps:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Cycle has no steps; cannot advance",
        )

    state = _get_or_create_state(session)
    new_ptr = next_pointer(
        current=state.pointer,
        completed_position=body.completed_step_position,
        length=len(steps),
    )
    state.pointer = new_ptr
    session.add(state)
    session.commit()

    return AdvanceResponse(pointer=new_ptr)
