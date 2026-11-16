"""SQLModel data models for the Strength Tracker backend."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Exercise(SQLModel, table=True):
    """An exercise (built-in or custom)."""

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    muscle_group: str
    description: Optional[str] = None
    is_custom: bool = Field(default=False)


class WorkoutTemplate(SQLModel, table=True):
    """A named workout template (collection of exercises in order)."""

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str


class TemplateExercise(SQLModel, table=True):
    """Ordered exercise within a WorkoutTemplate."""

    id: Optional[int] = Field(default=None, primary_key=True)
    template_id: int = Field(foreign_key="workouttemplate.id")
    exercise_id: int = Field(foreign_key="exercise.id")
    position: int


class CycleStep(SQLModel, table=True):
    """One step in the training cycle.

    kind is one of: "template", "run", "rest".
    template_id is null for run/rest steps.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    position: int
    kind: str  # "template" | "run" | "rest"
    template_id: Optional[int] = Field(default=None, foreign_key="workouttemplate.id")


class CycleState(SQLModel, table=True):
    """Singleton row tracking the current position in the cycle."""

    id: int = Field(primary_key=True)
    pointer: int


class WorkoutSession(SQLModel, table=True):
    """A single workout session; id is a client-supplied UUID string."""

    id: str = Field(primary_key=True)
    started_at: datetime
    template_id: Optional[int] = Field(default=None, foreign_key="workouttemplate.id")
    finished_at: Optional[datetime] = None


class SetEntry(SQLModel, table=True):
    """One set performed during a WorkoutSession; id is a client-supplied UUID string."""

    id: str = Field(primary_key=True)
    session_id: str = Field(foreign_key="workoutsession.id")
    exercise_id: int = Field(foreign_key="exercise.id")
    position: int
    weight: float
    reps: int
    note: Optional[str] = None
    completed: bool = Field(default=False)


class BodyWeightEntry(SQLModel, table=True):
    """Body weight measurement at a given timestamp."""

    id: Optional[int] = Field(default=None, primary_key=True)
    recorded_at: datetime
    weight: float
