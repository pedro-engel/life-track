# life-track

A personal, single-user strength-training tracker — Hevy-style — built as an installable iPhone PWA on top of a Python/FastAPI backend. It gives your training **structure** (a routine cycle that tells you what's next) and shows your **progress** (load per exercise and body weight over time), without any social features.

> Status: **v1 complete** — backend API and the React PWA frontend are built, tested, and merged. An embedded AI assistant is planned for Phase 2 (see [Roadmap](#roadmap)).

> README language: English (the code, tests, and commits are in English). The app's UI and the design docs under `docs/` are in Portuguese. Happy to add a PT version if useful.

## What it does

- **Today screen** — opens on a greeting and the training **cycle**: what's up today and what's next ("Hoje" / "Amanhã"). The cycle is a *sequence* that advances when you train, not a calendar — skip a day and it waits for you.
- **Live workout** — log sets (weight × reps) with a **"última vez"** reference per set, a **rest timer**, and big one-handed inputs for use mid-set at the gym. The in-progress workout is persisted to **IndexedDB** as you type and synced with an **idempotent** API call, so a dropped connection never loses a workout.
- **Progress & history** — per-exercise progression and body-weight charts on a shared timeline, plus a history of past sessions.
- **Body weight** — quick logging with a trend chart.
- **Editors** — manage your exercise catalog, workout templates (ordered), and the routine cycle.
- **Installable PWA** — add to Home Screen on iPhone; safe-area aware, 44px touch targets, works as a standalone app.

## Tech stack

| Layer | Stack |
|---|---|
| Backend | Python 3.12+, FastAPI, SQLModel, SQLite, PyJWT, passlib/bcrypt |
| Frontend | React + TypeScript, Vite, `vite-plugin-pwa` (service worker + manifest), React Router |
| Tests | `pytest` (backend), Vitest + React Testing Library + `fake-indexeddb` (frontend) |

**Architecture:** single-service. In production FastAPI serves the built SPA (`frontend/dist`) as static files from one origin — relative API paths, no CORS. In development, the Vite dev server proxies the API paths to the backend. The live-workout flow uses client-generated UUIDs so writes to `POST /sessions/sync` are idempotent (safe to retry).

## Project structure

```
app/                 FastAPI backend
  main.py            app + routers + SPA static serving
  models.py          SQLModel tables
  auth.py            password hashing + JWT
  routers/           auth, exercises, templates, cycle, sessions, progress, bodyweight
  seed.py            base exercise catalog
frontend/            React + Vite PWA
  src/
    api/             typed API client + types
    auth/            token store + auth context
    screens/         Login, Today, Workout, Progress, editors/
    components/      SetRow, RestTimer, charts, TabBar, ...
    workout/         IndexedDB persistence + idempotent sync
    styles/          design tokens + component CSS
tests/               backend pytest suite
docs/superpowers/    design specs and implementation plans
```

## Getting started

Requires **Python 3.12+** and **Node 18+** (built with Node 22+).

### 1. Backend

```bash
# from the repo root
python -m venv .venv && . .venv/Scripts/activate   # Windows (Git Bash); use .venv/bin/activate on macOS/Linux
pip install -e .                                    # or: uv sync

# configure (see Configuration below), then run:
uvicorn app.main:app --reload                       # http://127.0.0.1:8000
```

The SQLite database and the base exercise catalog are created automatically on first run.

### 2. Frontend (development)

```bash
cd frontend
npm install
npm run dev        # Vite dev server; proxies /auth, /exercises, ... to http://127.0.0.1:8000
```

### 3. Production (single service)

```bash
cd frontend && npm run build        # outputs frontend/dist
uvicorn app.main:app                # FastAPI serves the built SPA at / and the API from the same origin
```

Serve it over HTTPS and behind your own host when deploying.

## Configuration

Settings are read from environment variables (or a `.env` file at the repo root):

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./strength_tracker.db` | SQLite file path |
| `JWT_SECRET` | `test-jwt-secret` | **Set a strong value before deploying** — the default is public and the app only *warns* at startup if it's left unchanged |
| `APP_PASSWORD_HASH` | bcrypt hash of `"REPLACE_ME"` | Your login password, bcrypt-hashed |

Generate a password hash with the project's own hasher:

```bash
python -c "from app.auth import hash_password; print(hash_password('your-password-here'))"
```

Then put the output in `APP_PASSWORD_HASH`. Login is `POST /auth/login` with `{"password": "..."}`, which returns a JWT used as `Authorization: Bearer <token>` on every other request. It's a single-user app — one password, no accounts.

## Running the tests

```bash
# backend
pytest -q

# frontend
cd frontend && npm test
```

## Roadmap

- **Phase 2 — Embedded AI.** A server-side `/ask` endpoint (Anthropic Claude, tool-calling over the existing read endpoints) that answers factual questions about your own data ("what was my last incline dumbbell bench?"). The UI already has a placeholder for it.
- **Life-summary dashboard** combining training with running (Strava, via screenshot/OCR or the API) and iPhone screen-time.
- Nice-to-haves: richer cycle view, drag-to-reorder in editors, hand-crafted app icons.

## Notes

- Personal, single-user app — no multi-user, no social features by design.
- Runs are tracked as a marker in the cycle for now ("today is a run"); Strava integration is future work.
