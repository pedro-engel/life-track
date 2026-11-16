# Strength Tracker — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Python/FastAPI + SQLite backend (JSON API) for a personal strength-training tracker, covering auth, exercise catalog, muscle-group templates, the training cycle, live-workout logging with idempotent sync, body weight, and progress/history queries.

**Architecture:** FastAPI app exposing a JSON API, backed by a single-file SQLite database via SQLModel. One user. The live-workout flow accepts client-generated IDs so the PWA can persist locally and sync idempotently when connectivity returns. The frontend (PWA) is a separate plan that consumes this API.

**Tech Stack:** Python 3.12+, FastAPI, SQLModel (SQLAlchemy + Pydantic), Uvicorn, pytest + httpx TestClient, passlib[bcrypt] for password hashing, PyJWT for session tokens. Dependency management via `uv` (pip works too).

**Spec:** `docs/superpowers/specs/2026-11-16-strength-tracker-design.md`

## Global Constraints

- Backend is **Python + FastAPI**; database is **SQLite**, a single file.
- **Single user.** No multi-user, no social features, no run logging, no body measurements beyond weight.
- **Auth:** real password (not a 4-digit PIN), hashed with bcrypt; session via JWT token; **no** rate limiting/lockout. App is served over HTTPS in production (deployment concern, not code).
- **"última vez" semantics:** for set index N of the current workout, return set index N from the **most recent past session where that exercise was logged**; if that session had fewer sets, fall back to its **last** set; if the exercise was never logged, return nothing.
- **Cycle pointer rules:** completing the current step advances the pointer by one; completing a step that is **not** the current one moves the pointer to just after that step; "run" and "rest" steps advance on an explicit "done" action; advancing past the last step **wraps** to the first. Never block skipping/reordering.
- **Sync:** set writes are **idempotent** — client supplies stable IDs (UUID strings) for sessions and set entries; re-sending the same payload must not duplicate.
- **Seams only (do not build):** Strava read integration and the AI advisor. Model the "run" cycle step so it can gain data later; keep the app structured so an advisor endpoint could be added.

## Review Focus

- **Duplicate sync payload** (network retry re-sends the same session/sets): must upsert, not duplicate rows → tested in Task 7.
- **"última vez" for a never-before-logged exercise:** must return empty, not error → tested in Task 8.
- **Editing/deleting a catalog exercise referenced by past sessions:** historical set entries must keep their data and not break → tested in Task 4.
- **Advancing the cycle past the final step:** must wrap to the first step, not go out of range → tested in Task 6.
- **Non-positive or missing weight/reps, and two body-weight entries on one day:** weight ≥ 0 and reps ≥ 0 enforced; two body-weight entries same day both kept (ordered by timestamp) → tested in Tasks 7 and 9.

---

### Task 1: Project scaffold, config, health check, test harness

**Files:**
- Create: `pyproject.toml`, `app/__init__.py`, `app/main.py`, `app/config.py`, `app/db.py`
- Test: `tests/conftest.py`, `tests/test_health.py`

**Interfaces:**
- Produces: `app.main:app` (FastAPI instance). `app.db:get_session` (FastAPI dependency yielding a SQLModel `Session`). `app.db:init_db()` (creates tables). `app.config:Settings` (reads `DATABASE_URL`, `JWT_SECRET`, `APP_PASSWORD_HASH` from env; test defaults to in-memory/temp SQLite). `tests/conftest.py` exposes a `client` fixture (httpx `TestClient` over a fresh temp DB).

- [ ] **Step 1: Write the failing test** — `tests/test_health.py::test_health_returns_ok`: `GET /health` → status 200, body `{"status": "ok"}`.
- [ ] **Step 2: Run it, verify it fails** (`pytest tests/test_health.py -v`) — Expected: FAIL (app/route missing).
- [ ] **Step 3: Implement** the FastAPI `app` in `app/main.py` with a `GET /health` route; `Settings` in `app/config.py`; `engine`, `get_session`, `init_db` in `app/db.py`; the `client` fixture in `conftest.py` pointing at a temp SQLite file created per test.
- [ ] **Step 4: Run tests, verify pass.**
- [ ] **Step 5: Commit** — `feat: scaffold FastAPI app with health check and test harness`.

---

### Task 2: Data models

**Files:**
- Create: `app/models.py`
- Test: `tests/test_models.py`

**Interfaces:**
- Produces SQLModel tables (exact field names later tasks rely on):
  - `Exercise(id:int pk, name:str, muscle_group:str, description:str|None, is_custom:bool=False)`
  - `WorkoutTemplate(id:int pk, name:str)`
  - `TemplateExercise(id:int pk, template_id:int fk, exercise_id:int fk, position:int)` — ordered exercises in a template.
  - `CycleStep(id:int pk, position:int, kind:str ["template"|"run"|"rest"], template_id:int|None fk)` — ordered cycle; single cycle for the one user.
  - `CycleState(id:int pk=1, pointer:int)` — current position in the cycle (singleton row).
  - `WorkoutSession(id:str pk [client UUID], started_at:datetime, template_id:int|None, finished_at:datetime|None)`
  - `SetEntry(id:str pk [client UUID], session_id:str fk, exercise_id:int fk, position:int, weight:float, reps:int, note:str|None, completed:bool=False)`
  - `BodyWeightEntry(id:int pk, recorded_at:datetime, weight:float)`

- [ ] **Step 1: Write the failing test** — `tests/test_models.py::test_tables_created_and_roundtrip`: call `init_db()`, insert one `Exercise` and one `WorkoutSession` with a `SetEntry`, read them back, assert field values and the FK link resolve.
- [ ] **Step 2: Run it, verify it fails.**
- [ ] **Step 3: Implement** the SQLModel classes in `app/models.py` with the fields above; ensure `init_db()` imports this module so tables register.
- [ ] **Step 4: Run tests, verify pass.**
- [ ] **Step 5: Commit** — `feat: add SQLModel data models`.

---

### Task 3: Authentication (password login + JWT, auth dependency)

**Files:**
- Create: `app/auth.py`, `app/routers/auth.py`
- Modify: `app/main.py` (include router)
- Test: `tests/test_auth.py`

**Interfaces:**
- Consumes: `Settings.APP_PASSWORD_HASH`, `Settings.JWT_SECRET`.
- Produces: `POST /auth/login` body `{"password": str}` → 200 `{"token": str}` on match, 401 on mismatch. `require_auth` dependency → raises 401 without a valid `Authorization: Bearer <token>`, else returns the subject. `app.auth:hash_password(pw)->str`, `verify_password(pw, hash)->bool`, `create_token()->str`, `decode_token(tok)->dict`.

- [ ] **Step 1: Write failing tests** — `test_login_wrong_password_401`; `test_login_correct_password_returns_token`; `test_protected_route_without_token_401`; `test_protected_route_with_token_200` (use a throwaway route depending on `require_auth`).
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** bcrypt hash/verify, JWT create/decode, the login router, and `require_auth`. No lockout/rate limiting (per Global Constraints).
- [ ] **Step 4: Run tests, verify pass.**
- [ ] **Step 5: Commit** — `feat: add password login and JWT auth`.

---

### Task 4: Exercise catalog (CRUD + base-list seed)

**Files:**
- Create: `app/routers/exercises.py`, `app/seed.py`
- Modify: `app/main.py` (include router), `app/db.py` (call seed on init if empty)
- Test: `tests/test_exercises.py`

**Interfaces:**
- Consumes: `require_auth`, models.
- Produces: `GET /exercises` (optional `?muscle_group=`) → list; `POST /exercises` `{name, muscle_group, description?}` → created with `is_custom=True`; `PATCH /exercises/{id}` → edit name/description; `app.seed:seed_exercises(session)` inserts a base list grouped by muscle group (chest/back/shoulders/legs/arms/core) with `is_custom=False` when the table is empty.

- [ ] **Step 1: Write failing tests** — `test_seed_populates_base_exercises` (base list present, `is_custom=False`); `test_create_custom_exercise` (`is_custom=True`); `test_filter_by_muscle_group`; `test_edit_exercise_name`; **Review Focus** — `test_editing_exercise_keeps_past_set_entry_intact`: create exercise, log a session+set referencing it, rename the exercise, assert the past `SetEntry` still resolves and keeps its weight/reps.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** the router and `seed_exercises`; wire seeding into `init_db` when the exercise table is empty. The base-list contents are the implementer's reasonable choice per muscle group.
- [ ] **Step 4: Run tests, verify pass.**
- [ ] **Step 5: Commit** — `feat: exercise catalog with base-list seed`.

---

### Task 5: Workout templates (CRUD with ordered exercises)

**Files:**
- Create: `app/routers/templates.py`
- Modify: `app/main.py`
- Test: `tests/test_templates.py`

**Interfaces:**
- Consumes: `require_auth`, models, exercises.
- Produces: `POST /templates` `{name, exercise_ids: [int]}` → creates template + ordered `TemplateExercise` rows by list order; `GET /templates` and `GET /templates/{id}` → template with its ordered exercises (full exercise objects); `PATCH /templates/{id}` → rename and/or replace the ordered exercise list; `DELETE /templates/{id}`.

- [ ] **Step 1: Write failing tests** — `test_create_template_preserves_exercise_order`; `test_get_template_returns_ordered_exercises`; `test_patch_replaces_exercise_list`; `test_delete_template`.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** the router; store/read `position` to preserve order.
- [ ] **Step 4: Run tests, verify pass.**
- [ ] **Step 5: Commit** — `feat: workout templates with ordered exercises`.

---

### Task 6: Routine cycle (define + pointer advance logic)

**Files:**
- Create: `app/routers/cycle.py`, `app/cycle_logic.py`
- Modify: `app/main.py`
- Test: `tests/test_cycle.py`

**Interfaces:**
- Consumes: `require_auth`, models.
- Produces: `PUT /cycle` `{steps: [{kind, template_id?}]}` → replaces the cycle, resets pointer to 0; `GET /cycle` → steps + current pointer + the resolved "next" step; `POST /cycle/advance` `{completed_step_position: int}` → applies the pointer rules and returns the new pointer. `app.cycle_logic:next_pointer(current:int, completed_position:int, length:int) -> int` — pure function implementing the rules.

- [ ] **Step 1: Write failing tests** for `next_pointer` (pure) — `test_completing_current_advances_by_one`; `test_completing_out_of_order_moves_to_after_that_step`; **Review Focus** — `test_advancing_past_last_wraps_to_zero`. Plus router tests: `test_put_cycle_resets_pointer`, `test_get_cycle_returns_next_step`.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** `next_pointer` with this logic, then the router:

```
next_pointer(current, completed_position, length):
    base = completed_position if completed_position is not None else current
    return (base + 1) % length
```

- [ ] **Step 4: Run tests, verify pass.**
- [ ] **Step 5: Commit** — `feat: routine cycle with pointer advance rules`.

---

### Task 7: Workout sessions + set entries + idempotent sync

**Files:**
- Create: `app/routers/sessions.py`
- Modify: `app/main.py`
- Test: `tests/test_sessions.py`

**Interfaces:**
- Consumes: `require_auth`, models.
- Produces: `POST /sessions/sync` body `{session: {id, started_at, template_id?, finished_at?}, sets: [{id, exercise_id, position, weight, reps, note?, completed}]}` → **upserts** the session and all sets by their client IDs; returns the stored session with sets. `GET /sessions` → history (most recent first). `GET /sessions/{id}`. Validation: `weight >= 0`, `reps >= 0` (422 otherwise).

- [ ] **Step 1: Write failing tests** — `test_sync_creates_session_and_sets`; **Review Focus** — `test_sync_same_payload_twice_is_idempotent` (row counts unchanged, values updated not duplicated); `test_sync_updates_existing_set_values`; `test_history_orders_most_recent_first`; **Review Focus** — `test_negative_weight_or_reps_rejected_422`.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** the sync router doing get-or-create by client UUID then field update; add weight/reps validators on the request schema.
- [ ] **Step 4: Run tests, verify pass.**
- [ ] **Step 5: Commit** — `feat: workout session sync with idempotent set writes`.

---

### Task 8: "Última vez" reference query

**Files:**
- Create: `app/routers/progress.py` (shared with Task 10), `app/progress_logic.py`
- Modify: `app/main.py`
- Test: `tests/test_last_time.py`

**Interfaces:**
- Consumes: `require_auth`, models.
- Produces: `GET /exercises/{id}/last-set?position=N` → `{weight, reps, note, session_date}` or `null`. `app.progress_logic:last_set_for(session, exercise_id, position) -> SetEntry | None` implementing the Global-Constraints semantics (same index from most recent prior session with that exercise; fall back to that session's last set; else None).

- [ ] **Step 1: Write failing tests** — `test_last_set_returns_same_index_from_prior_session`; `test_last_set_falls_back_to_last_set_when_fewer`; **Review Focus** — `test_last_set_returns_null_for_never_logged_exercise`.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** `last_set_for` (find most recent prior session containing the exercise, pick set at `position` or the max position ≤ it) and the route.
- [ ] **Step 4: Run tests, verify pass.**
- [ ] **Step 5: Commit** — `feat: last-time reference lookup for sets`.

---

### Task 9: Body weight entries

**Files:**
- Create: `app/routers/bodyweight.py`
- Modify: `app/main.py`
- Test: `tests/test_bodyweight.py`

**Interfaces:**
- Consumes: `require_auth`, models.
- Produces: `POST /bodyweight` `{weight, recorded_at?}` (defaults to now) → created; `GET /bodyweight` → entries ordered by `recorded_at` ascending (for charting). Validation `weight > 0` (422 otherwise).

- [ ] **Step 1: Write failing tests** — `test_log_bodyweight`; `test_list_bodyweight_ordered_by_time`; **Review Focus** — `test_two_entries_same_day_both_kept`; `test_nonpositive_weight_rejected_422`.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** the router with the validator.
- [ ] **Step 4: Run tests, verify pass.**
- [ ] **Step 5: Commit** — `feat: body weight logging`.

---

### Task 10: Progress — per-exercise history on a shared timeline

**Files:**
- Modify: `app/routers/progress.py`
- Test: `tests/test_progress.py`

**Interfaces:**
- Consumes: `require_auth`, models.
- Produces: `GET /exercises/{id}/progress` → time series `[{date, top_weight, total_reps}]` (one point per session that logged the exercise, chronological). Body-weight series is already served by Task 9; the frontend overlays the two on a shared time axis.

- [ ] **Step 1: Write failing tests** — `test_progress_series_one_point_per_session_chronological`; `test_progress_top_weight_is_max_of_sets`; `test_progress_empty_for_unlogged_exercise`.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** the aggregation query.
- [ ] **Step 4: Run tests, verify pass.**
- [ ] **Step 5: Commit** — `feat: per-exercise progress series`.

---

## Notes for the frontend plan (not built here)

The PWA is a separate plan built with the `design-taste-frontend` skill. It consumes this API, persists the in-progress workout locally (IndexedDB), and calls `POST /sessions/sync` to flush when online. This backend's client-ID-based idempotent sync is the contract that makes that safe.
