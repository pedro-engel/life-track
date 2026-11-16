import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
import app.db as db_module
from app.main import app
from app.db import get_session


@pytest.fixture(name="client")
def client_fixture(tmp_path):
    """Provide a TestClient backed by a fresh per-test temporary SQLite file."""
    db_path = tmp_path / "test.db"
    db_url = f"sqlite:///{db_path}"

    test_engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(test_engine)

    # Patch the module-level engine so lifespan init_db() uses the test DB
    original_engine = db_module.engine
    db_module.engine = test_engine

    def override_get_session():
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    db_module.engine = original_engine
    test_engine.dispose()
