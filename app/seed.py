"""Seed data for the exercise catalog.

``seed_exercises`` inserts a base list of common exercises grouped by
muscle group.  It is a no-op when the exercise table already contains rows,
so it is safe to call on every application start-up.
"""
from sqlmodel import Session, select

from app.models import Exercise

# ---------------------------------------------------------------------------
# Base exercise list — one reasonable entry per group is enough for the
# scaffold; each muscle group gets several common movements.
# ---------------------------------------------------------------------------
_BASE_EXERCISES: list[dict] = [
    # Chest
    {"name": "Bench Press", "muscle_group": "chest", "description": "Flat barbell bench press"},
    {"name": "Incline Bench Press", "muscle_group": "chest", "description": "Incline barbell press"},
    {"name": "Push-Up", "muscle_group": "chest", "description": "Bodyweight push-up"},
    {"name": "Cable Fly", "muscle_group": "chest", "description": "Cable chest fly"},
    # Back
    {"name": "Pull-Up", "muscle_group": "back", "description": "Bodyweight pull-up"},
    {"name": "Barbell Row", "muscle_group": "back", "description": "Bent-over barbell row"},
    {"name": "Lat Pulldown", "muscle_group": "back", "description": "Cable lat pulldown"},
    {"name": "Seated Cable Row", "muscle_group": "back", "description": "Seated cable row"},
    # Shoulders
    {"name": "Overhead Press", "muscle_group": "shoulders", "description": "Standing barbell overhead press"},
    {"name": "Lateral Raise", "muscle_group": "shoulders", "description": "Dumbbell lateral raise"},
    {"name": "Front Raise", "muscle_group": "shoulders", "description": "Dumbbell front raise"},
    {"name": "Face Pull", "muscle_group": "shoulders", "description": "Cable face pull"},
    # Legs
    {"name": "Squat", "muscle_group": "legs", "description": "Barbell back squat"},
    {"name": "Deadlift", "muscle_group": "legs", "description": "Conventional barbell deadlift"},
    {"name": "Leg Press", "muscle_group": "legs", "description": "Machine leg press"},
    {"name": "Lunges", "muscle_group": "legs", "description": "Walking or stationary lunges"},
    {"name": "Leg Curl", "muscle_group": "legs", "description": "Lying leg curl machine"},
    # Arms
    {"name": "Barbell Curl", "muscle_group": "arms", "description": "Standing barbell curl"},
    {"name": "Hammer Curl", "muscle_group": "arms", "description": "Dumbbell hammer curl"},
    {"name": "Tricep Dip", "muscle_group": "arms", "description": "Parallel-bar tricep dip"},
    {"name": "Tricep Pushdown", "muscle_group": "arms", "description": "Cable tricep pushdown"},
    # Core
    {"name": "Plank", "muscle_group": "core", "description": "Forearm plank hold"},
    {"name": "Crunch", "muscle_group": "core", "description": "Floor crunch"},
    {"name": "Leg Raise", "muscle_group": "core", "description": "Hanging or lying leg raise"},
    {"name": "Ab Rollout", "muscle_group": "core", "description": "Ab wheel rollout"},
]


def seed_exercises(session: Session) -> None:
    """Insert base exercises when the exercise table is empty.

    This function is idempotent: if any row already exists it returns
    immediately without touching the database.
    """
    existing = session.exec(select(Exercise)).first()
    if existing is not None:
        return

    for data in _BASE_EXERCISES:
        exercise = Exercise(
            name=data["name"],
            muscle_group=data["muscle_group"],
            description=data.get("description"),
            is_custom=False,
        )
        session.add(exercise)

    session.commit()
