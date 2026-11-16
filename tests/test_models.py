"""Roundtrip test for all SQLModel data models (Task 2)."""
import uuid
from datetime import datetime, timezone

import pytest
from sqlmodel import SQLModel, Session, create_engine, select

import app.db as db_module
from app.db import init_db


@pytest.fixture(name="db_session")
def db_session_fixture(tmp_path):
    """Fresh per-test SQLite DB with all tables created."""
    db_path = tmp_path / "models_test.db"
    db_url = f"sqlite:///{db_path}"

    test_engine = create_engine(db_url, connect_args={"check_same_thread": False})

    # Point module engine at the test DB so init_db() uses it
    original_engine = db_module.engine
    db_module.engine = test_engine

    init_db()

    with Session(test_engine) as session:
        yield session

    db_module.engine = original_engine
    test_engine.dispose()


def test_tables_created_and_roundtrip(db_session: Session):
    """Insert Exercise, WorkoutSession, SetEntry; read back; verify FK link."""
    from app.models import (
        BodyWeightEntry,
        CycleState,
        CycleStep,
        Exercise,
        SetEntry,
        TemplateExercise,
        WorkoutSession,
        WorkoutTemplate,
    )

    session = db_session

    # --- Exercise ---
    ex = Exercise(name="Squat", muscle_group="Legs", description="Barbell squat", is_custom=False)
    session.add(ex)
    session.commit()
    session.refresh(ex)

    assert ex.id is not None
    assert ex.name == "Squat"
    assert ex.muscle_group == "Legs"
    assert ex.description == "Barbell squat"
    assert ex.is_custom is False

    # --- WorkoutSession ---
    ws_id = str(uuid.uuid4())
    started = datetime.now(timezone.utc)
    ws = WorkoutSession(id=ws_id, started_at=started, template_id=None, finished_at=None)
    session.add(ws)
    session.commit()
    session.refresh(ws)

    assert ws.id == ws_id
    assert ws.started_at == started
    assert ws.template_id is None
    assert ws.finished_at is None

    # --- SetEntry ---
    se_id = str(uuid.uuid4())
    se = SetEntry(
        id=se_id,
        session_id=ws_id,
        exercise_id=ex.id,
        position=1,
        weight=100.0,
        reps=5,
        note="Felt good",
        completed=False,
    )
    session.add(se)
    session.commit()
    session.refresh(se)

    assert se.id == se_id
    assert se.session_id == ws_id
    assert se.exercise_id == ex.id
    assert se.weight == 100.0
    assert se.reps == 5
    assert se.note == "Felt good"
    assert se.completed is False

    # FK link: read the SetEntry back and verify session_id resolves to WorkoutSession
    retrieved_se = session.get(SetEntry, se_id)
    assert retrieved_se is not None
    retrieved_ws = session.get(WorkoutSession, retrieved_se.session_id)
    assert retrieved_ws is not None
    assert retrieved_ws.id == ws_id

    # --- WorkoutTemplate ---
    tmpl = WorkoutTemplate(name="Push Day")
    session.add(tmpl)
    session.commit()
    session.refresh(tmpl)
    assert tmpl.id is not None
    assert tmpl.name == "Push Day"

    # --- TemplateExercise ---
    te = TemplateExercise(template_id=tmpl.id, exercise_id=ex.id, position=1)
    session.add(te)
    session.commit()
    session.refresh(te)
    assert te.id is not None
    assert te.template_id == tmpl.id
    assert te.exercise_id == ex.id

    # --- CycleStep ---
    cs = CycleStep(position=0, kind="template", template_id=tmpl.id)
    session.add(cs)
    session.commit()
    session.refresh(cs)
    assert cs.id is not None
    assert cs.kind == "template"
    assert cs.template_id == tmpl.id

    cs_rest = CycleStep(position=1, kind="rest", template_id=None)
    session.add(cs_rest)
    session.commit()
    session.refresh(cs_rest)
    assert cs_rest.template_id is None
    assert cs_rest.kind == "rest"

    # --- CycleState singleton ---
    cstate = CycleState(id=1, pointer=0)
    session.add(cstate)
    session.commit()
    session.refresh(cstate)
    assert cstate.id == 1
    assert cstate.pointer == 0

    # --- BodyWeightEntry ---
    bw = BodyWeightEntry(recorded_at=started, weight=80.5)
    session.add(bw)
    session.commit()
    session.refresh(bw)
    assert bw.id is not None
    assert bw.weight == 80.5
