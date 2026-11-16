from sqlmodel import SQLModel, Session, create_engine
from typing import Generator
from app.config import settings

# Import models so their tables are registered with SQLModel metadata before
# create_all() is called.
import app.models  # noqa: F401  (side-effect import)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    """Create all SQLModel tables and seed base exercises when the table is empty."""
    SQLModel.metadata.create_all(engine)
    # Deferred import avoids a circular-import at module load time.
    from app.seed import seed_exercises  # noqa: PLC0415
    with Session(engine) as session:
        seed_exercises(session)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session."""
    with Session(engine) as session:
        yield session
