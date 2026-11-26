from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.db import init_db
from app.routers import auth as auth_router
from app.routers import exercises as exercises_router
from app.routers import templates as templates_router
from app.routers import cycle as cycle_router
from app.routers import sessions as sessions_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Strength Tracker API", lifespan=lifespan)

app.include_router(auth_router.router)
app.include_router(exercises_router.router)
app.include_router(templates_router.router)
app.include_router(cycle_router.router)
app.include_router(sessions_router.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
