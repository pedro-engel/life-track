# life-track v1 Frontend PWA (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the installable iPhone PWA for life-track — a Today screen, offline-resilient live-workout logging, progress/body-weight, and the catalog/template/cycle editors — on top of the existing FastAPI JSON API, reproducing the approved `.taste-skill/app/` visual prototype.

**Architecture:** A React + TypeScript + Vite single-page PWA in `frontend/`. In development, Vite proxies `/api`-shaped calls to the FastAPI backend. In production, FastAPI serves the built SPA as static files from one origin (relative API paths, no CORS). The in-progress workout is persisted to IndexedDB as the user types and flushed to the idempotent `POST /sessions/sync` with stable client UUIDs, so a dropped gym connection never loses a workout.

**Tech Stack:** React 18 + TypeScript, Vite, `vite-plugin-pwa` (Workbox service worker + manifest), React Router, Vitest + React Testing Library + `fake-indexeddb` for tests. Charts: implementer's choice (Recharts or hand-drawn SVG) following the `dataviz` skill. Fonts: Instrument Sans + Instrument Serif (Google Fonts).

**Spec:** `docs/superpowers/specs/2026-11-26-life-track-v1-frontend-ai-design.md` (read it; this plan argues from it). Visual reference: the static prototype in `.taste-skill/app/` (`index.html` = Today, `workout.html` = Live workout, `life.css`, `data.js`).

## Global Constraints

- **Stack:** React + TypeScript + Vite, built as an installable PWA. No framework migration; this is a new `frontend/` dir alongside the existing `app/` backend.
- **Single-service in production:** FastAPI serves the built SPA (`frontend/dist`) as static files; API paths are **relative** (`/auth/login`, `/cycle`, …); **no CORS**. In dev, Vite dev-server proxies those paths to the backend (default `http://127.0.0.1:8000`). The API base is `""` (same origin) in prod.
- **Auth:** `POST /auth/login` body `{"password": str}` → `200 {"token": str}` or `401`. The JWT is stored client-side (localStorage) and sent as `Authorization: Bearer <token>` on **every** non-login request. A `401` from any call clears the token and routes to login.
- **Offline resilience (non-negotiable):** the active workout (session + every set edit) is written to IndexedDB immediately on each change, keyed by a client-generated session UUID (`crypto.randomUUID()`) and per-set UUIDs. Flushing calls `POST /sessions/sync` with those exact UUIDs; re-sending the same payload must not duplicate (backend is idempotent). A reload or a dropped connection mid-workout loses nothing.
- **"última vez":** always fetched via `GET /exercises/{id}/last-set?position=N&exclude_session_id=<active session id>` so it never echoes the session in progress. A `null` body (HTTP 200) means "primeira vez" — render that, never an error or a spinner.
- **iPhone / PWA:** `manifest.webmanifest` + real `icon-192.png` / `icon-512.png`; a service worker (cache the app shell; the workout's own durability is IndexedDB, not the SW); `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`; `env(safe-area-inset-*)` padding on the top bar and the pinned bottom tab bar; iOS standalone meta tags (`apple-mobile-web-app-capable`, `-status-bar-style`, `-title`); touch targets ≥ 44px; the bottom tab bar and the rest timer are **position-pinned** (fixed), not in normal flow. Primary design width 390px.
- **Visual (reproduce the prototype):** style `editorial-greeting`; Instrument Sans body + Instrument Serif for the greeting h1 **only**; accent teal `#1b6e66` on data/actions only (≈2% of pixels); `--radius-card: 22px`; tonal panels one step off white; no shadows at rest. The cycle **Hoje / Amanhã** cards are the Today screen's hero. Tokens come from the dealt sheet (`.taste-skill/app/` CSS).
- **AI is Phase 2:** the "Perguntar à IA" affordance on Today is a visible but **disabled placeholder** in Phase 1 (no `/ask` call). The `POST /ask` endpoint + live ask UI are a separate plan.

## Review Focus

- **Connection drops mid-workout** (airplane mode in the gym, app backgrounded): every set already entered must survive a reload and flush on reconnect **without duplicating rows**. → Task 4 tests: reload restores from IndexedDB; two flushes of the same payload yield identical server rows (same UUIDs).
- **última-vez echoing today's sets** (the frontend synced the active session, then re-queried): the last-set call must carry `exclude_session_id` of the active session, so it returns the *prior* session, not today's. → Task 4 test asserts the query param is sent.
- **Exercise never logged before:** `GET …/last-set` returns `null` (HTTP 200); the UI shows "primeira vez", not a crash, dash-at-load, or spinner. → Task 3/Task 4 test with a `null` response.
- **Expired or invalid token:** any API call returning `401` clears the stored token and lands on the login screen — never a white screen or an infinite spinner. → Task 2 test on the fetch wrapper.
- **First-run / empty data:** no cycle steps (`GET /cycle` → `steps: []`), no sessions, no body-weight entries: each screen keeps its frame and shows an honest empty state. → Task 3 (no cycle), Task 5 (empty charts/history) tests.

---

### Task 1: Scaffold — Vite+React+TS PWA, tokens, fonts, test harness, FastAPI static-serve + dev proxy

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/styles/tokens.css`, `frontend/src/test/setup.ts`
- Create: `frontend/src/App.test.tsx`
- Modify: `app/main.py` (mount the built SPA as static files, after the API routers)
- Modify: `app/__init__` area is untouched; only `main.py` changes
- Test: `frontend/src/App.test.tsx`; backend `tests/test_spa_serving.py`

**Interfaces:**
- Produces: a booting SPA shell (`App`) and the token CSS variables used by every later task (`--accent:#1b6e66`, `--radius-card:22px`, `--surface`, `--ground`, `--text`, `--muted`, font families). `vite.config.ts` exposes a dev `server.proxy` mapping the API paths to the backend. FastAPI serves `frontend/dist` at `/` with an SPA fallback, without shadowing `/health` or any API router prefix (`/auth`, `/exercises`, `/templates`, `/cycle`, `/sessions`, `/bodyweight`).

- [ ] **Step 1: Write the failing tests**
  - `frontend/src/App.test.tsx::renders app shell` — renders `<App/>`, asserts the document has the app root and the Instrument Sans family is referenced on `document.body` (computed `font-family` contains "Instrument Sans").
  - `tests/test_spa_serving.py::test_root_serves_index` — with a stub `frontend/dist/index.html` present, `GET /` returns 200 and HTML containing `<div id="root">`.
  - `tests/test_spa_serving.py::test_health_still_ok` — `GET /health` still returns `{"status":"ok"}` (static mount must not shadow it).
  - `tests/test_spa_serving.py::test_unknown_client_route_falls_back` — `GET /today` (a client route) returns the SPA `index.html`, not 404.
- [ ] **Step 2: Run them, verify they fail** — `cd frontend && npm test` (App test: no app yet); `pytest tests/test_spa_serving.py -v` (no static mount yet).
- [ ] **Step 3: Implement**
  - Scaffold the Vite React-TS app in `frontend/`; add `vite-plugin-pwa`, React Router, Vitest + RTL + `fake-indexeddb` (wired in `src/test/setup.ts`). `tokens.css` holds the dealt sheet's tokens and `@import`s the two Google fonts; `main.tsx` imports it.
  - `vite.config.ts`: `server.proxy` forwarding `/auth`, `/exercises`, `/templates`, `/cycle`, `/sessions`, `/bodyweight` to `http://127.0.0.1:8000`.
  - In `app/main.py`, after all `include_router` calls, mount `StaticFiles(directory="frontend/dist", html=True)` at `/` guarded by a check that the dir exists (so the backend still boots in dev/test without a build), plus a catch-all that returns `index.html` for non-API, non-file paths (SPA fallback). Keep `/health` and router prefixes declared **before** the static mount so they win.
- [ ] **Step 4: Run tests, verify pass** — both suites green.
- [ ] **Step 5: Commit** — `feat(frontend): scaffold Vite React PWA, tokens, FastAPI static-serve + dev proxy`.

---

### Task 2: API client, login, token handling, protected routes

**Files:**
- Create: `frontend/src/api/types.ts`, `frontend/src/api/client.ts`, `frontend/src/auth/token.ts`, `frontend/src/auth/useAuth.tsx`, `frontend/src/screens/Login.tsx`, `frontend/src/components/ProtectedRoute.tsx`
- Test: `frontend/src/api/client.test.ts`, `frontend/src/screens/Login.test.tsx`

**Interfaces:**
- Consumes: Task 1's app shell/router.
- Produces (exact backend shapes — match verbatim):
  - `types.ts`: `Exercise {id:number; name:string; muscle_group:string; description:string|null; is_custom:boolean}`; `TemplateResponse {id:number; name:string; exercises:Exercise[]}`; `StepResponse {position:number; kind:"template"|"run"|"rest"; template_id:number|null}`; `CycleGetResponse {steps:StepResponse[]; pointer:number; next:StepResponse|null}`; `SetEntryOut {id:string; session_id:string; exercise_id:number; position:number; weight:number; reps:number; note:string|null; completed:boolean}`; `SessionResponse {id:string; started_at:string; template_id:number|null; finished_at:string|null; sets:SetEntryOut[]}`; `LastSet {weight:number; reps:number; note:string|null; session_date:string} | null`; `ProgressPoint {date:string; top_weight:number; total_reps:number}`; `BodyWeightOut {id:number; recorded_at:string; weight:number}`.
  - `client.ts`: a `request()` wrapper that attaches the bearer token and, on `401`, calls `clearToken()` and throws a typed `AuthError`; plus typed functions: `login(password)`, `getCycle()`, `getTemplate(id)`, `listTemplates()`, `createTemplate`, `updateTemplate`, `deleteTemplate`, `listExercises(muscleGroup?)`, `createExercise`, `updateExercise`, `getLastSet(exerciseId, position, excludeSessionId?)`, `getProgress(exerciseId)`, `syncSession(payload)`, `listSessions()`, `getSession(id)`, `putCycle(steps)`, `advanceCycle(completedPosition)`, `listBodyweight()`, `logBodyweight(weight, recordedAt?)`.
  - `token.ts`: `getToken()`, `setToken(t)`, `clearToken()` (localStorage).

- [ ] **Step 1: Write the failing tests**
  - `client.test.ts::login stores token` — mock `fetch` to return `{token:"jwt"}`; `await login("pw")`; assert `getToken()==="jwt"`.
  - `client.test.ts::attaches bearer` — mock fetch; call `getCycle()`; assert the request carried header `Authorization: "Bearer jwt"`.
  - `client.test.ts::401 clears token and throws AuthError` — mock fetch → 401; call `getCycle()`; assert it rejects with `AuthError` and `getToken()` is now `null`. **(Review Focus: expired token.)**
  - `Login.test.tsx::wrong password shows error` — mock `login` → rejects 401; submit; assert an error message renders and no navigation happened.
  - `Login.test.tsx::success navigates` — mock `login` resolves; submit; assert `onAuthenticated`/redirect fired.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** the typed client and `request()` wrapper (relative base URL; JSON; bearer; 401→clear+AuthError), the token store, a `useAuth` context, the `Login` screen (single password field, ≥44px submit, teal primary), and `ProtectedRoute` (redirects to `/login` when no token).
- [ ] **Step 4: Run tests, verify pass.**
- [ ] **Step 5: Commit** — `feat(frontend): typed API client, login, token + protected routes`.

---

### Task 3: Today screen (greeting, cycle Hoje/Amanhã, today's plan, body-weight tile)

**Files:**
- Create: `frontend/src/screens/Today.tsx`, `frontend/src/components/Greeting.tsx`, `frontend/src/components/CycleCards.tsx`, `frontend/src/components/PlanPanel.tsx`, `frontend/src/components/Panel.tsx`, `frontend/src/lib/cycle.ts`
- Test: `frontend/src/screens/Today.test.tsx`, `frontend/src/lib/cycle.test.ts`

**Interfaces:**
- Consumes: Task 2 client (`getCycle`, `getTemplate`, `getLastSet`, `listBodyweight`, `listSessions`).
- Produces: `lib/cycle.ts::nextStep(cycle: CycleGetResponse): StepResponse|null` (the step after `pointer` in sequence, wrapping) and `lib/cycle.ts::stepLabel(step)`; a `Today` route at `/` (and `/today`). The "Iniciar treino" button navigates to `/workout` with the current cycle step + its template id. A disabled "Perguntar à IA" row (Phase 2 placeholder).

- [ ] **Step 1: Write the failing tests**
  - `cycle.test.ts::nextStep wraps` — `pointer` at last step → `nextStep` returns `steps[0]`. `nextStep` of the current pointer step returns `steps[(pointer+1)%n]`.
  - `cycle.test.ts::empty cycle` — `steps: []` → `nextStep` returns `null`. **(Review Focus: first-run no cycle.)**
  - `Today.test.tsx::greeting + hoje/amanhã` — mock `getCycle` → a template "Peito" at pointer, "Costas" next; assert the serif greeting names the day's fact ("peito") and Hoje=Peito / Amanhã=Costas render.
  - `Today.test.tsx::plan shows última-vez and primeira vez` — mock `getTemplate` with exercises; `getLastSet` returns a value for one and `null` for another; assert "última vez: 60 kg × 8" and "primeira vez" both render. **(Review Focus: never-logged.)**
  - `Today.test.tsx::run step renders marker, no template fetch` — pointer on a `kind:"run"` step; assert it shows "Registrada no Strava"-style marker and does **not** call `getTemplate`.
  - `Today.test.tsx::empty cycle state` — `getCycle` → `steps:[]`; assert an honest "monte seu ciclo" empty state with a link to the cycle editor, not a crash.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** `Today` composing `Greeting` (morning/night variant decided by local hour — implementer's call per the spec), `CycleCards` (Hoje/Amanhã, teal on the current marker), `PlanPanel` (the next template's exercises with planned set count + última-vez), and a body-weight tile (latest entry + delta from `listBodyweight`). Reproduce the prototype layout/tokens. For `run`/`rest` steps render the marker and skip the template fetch.
- [ ] **Step 4: Run tests, verify pass.**
- [ ] **Step 5: Commit** — `feat(frontend): Today screen with cycle and day plan`.

---

### Task 4: Live workout — set logging, última-vez, rest timer, IndexedDB persistence, idempotent sync, cycle advance

**Files:**
- Create: `frontend/src/screens/Workout.tsx`, `frontend/src/components/SetRow.tsx`, `frontend/src/components/RestTimer.tsx`, `frontend/src/workout/localStore.ts`, `frontend/src/workout/sync.ts`, `frontend/src/workout/useWorkout.ts`
- Test: `frontend/src/workout/localStore.test.ts`, `frontend/src/workout/sync.test.ts`, `frontend/src/screens/Workout.test.tsx`

**Interfaces:**
- Consumes: Task 2 client (`getTemplate`, `getLastSet`, `syncSession`, `advanceCycle`), Task 3's navigation payload (cycle step position + template id).
- Produces:
  - `localStore.ts` (IndexedDB via a tiny wrapper or `idb`): `startWorkout(templateId): WorkoutDraft` (creates `id = crypto.randomUUID()`, `started_at = now`), `upsertSet(draft, set)`, `loadDraft(): WorkoutDraft|null`, `clearDraft()`. A `WorkoutDraft {id:string; started_at:string; template_id:number|null; sets: {id:string; exercise_id:number; position:number; weight:number; reps:number; note:string|null; completed:boolean}[]}`.
  - `sync.ts::flush(draft): Promise<SessionResponse>` → builds the `POST /sessions/sync` body `{session:{id,started_at,template_id,finished_at}, sets:[...]}` from the draft (same UUIDs) and posts it; safe to call repeatedly.
- Backend request shape (verbatim): `POST /sessions/sync` body `{ "session": {"id":str,"started_at":iso,"template_id":int|null,"finished_at":iso|null}, "sets": [{"id":str,"exercise_id":int,"position":int,"weight":float>=0,"reps":int>=0,"note":str|null,"completed":bool}] }`.

- [ ] **Step 1: Write the failing tests** (use `fake-indexeddb`)
  - `localStore.test.ts::set edits persist` — start a draft, upsert two sets, reload (new store instance), `loadDraft()` returns the draft with both sets and the same `id`. **(Review Focus: survives reload.)**
  - `sync.test.ts::idempotent` — mock fetch capturing bodies; `flush(draft)` twice; assert both posts carry the **identical** session id and set ids (so the idempotent backend updates, not duplicates). **(Review Focus: no duplication.)**
  - `sync.test.ts::rejects negative are prevented` — a set with `weight:-1` is clamped/blocked before posting (UI never sends `<0`, matching the backend 422 rule).
  - `Workout.test.tsx::última-vez uses exclude_session_id` — mock `getLastSet`; assert it's called with the **active draft's** `exclude_session_id`. **(Review Focus: no echo.)**
  - `Workout.test.tsx::primeira vez` — `getLastSet` → `null`; the field shows "primeira vez" placeholder, no spinner. **(Review Focus: never-logged.)**
  - `Workout.test.tsx::finish flushes and advances` — complete a set, tap Finalizar; assert `flush` ran then `advanceCycle(completedPosition)` was called with the cycle step's position, and the draft is cleared.
  - `RestTimer` test: starts on a completed set, counts down, "Pular" dismisses.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** `useWorkout` (hydrate from `loadDraft()` on mount, write to IndexedDB on every set edit), `Workout` screen (big tappable weight/reps inputs with última-vez as a hint, per the prototype; pinned `RestTimer`; "+ Adicionar série"; "Finalizar" → `flush` → `advanceCycle` → `clearDraft` → back to Today). `flush` runs on finish and opportunistically on reconnect (`online` event). última-vez fetched with `exclude_session_id = draft.id`.
- [ ] **Step 4: Run tests, verify pass.**
- [ ] **Step 5: Commit** — `feat(frontend): offline-resilient live workout with idempotent sync`.

---

### Task 5: Progress / history + body weight

**Files:**
- Create: `frontend/src/screens/Progress.tsx`, `frontend/src/components/ProgressChart.tsx`, `frontend/src/components/BodyWeightChart.tsx`, `frontend/src/components/HistoryList.tsx`, `frontend/src/components/LogBodyWeight.tsx`
- Test: `frontend/src/screens/Progress.test.tsx`

**Interfaces:**
- Consumes: Task 2 client (`getProgress`, `listBodyweight`, `logBodyweight`, `listSessions`, `listExercises`).
- Produces: a `/progress` route. The per-exercise progress series and the body-weight series render on a **shared time axis** (two charts stacked, same x-range, per the spec's "same timeline"). `LogBodyWeight` posts a new entry and refreshes the chart.

- [ ] **Step 1: Write the failing tests**
  - `Progress.test.tsx::progress chart from series` — mock `getProgress` → 3 points; assert 3 plotted points and the top-weight axis.
  - `Progress.test.tsx::empty progress` — `getProgress` → `[]`; assert an honest "sem histórico ainda" empty chart frame, not a crash. **(Review Focus: empty data.)**
  - `Progress.test.tsx::bodyweight chart + log` — mock `listBodyweight` → entries ascending; assert the line renders; `logBodyweight` called with the typed weight on submit; weight `0`/negative is blocked client-side (backend requires `>0`).
  - `Progress.test.tsx::history list` — mock `listSessions`; assert most-recent-first order and each row shows its date + template.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** the charts (teal on the data line, following `dataviz`; shared x-range computed from the union of both series' dates), the body-weight logger, and the session history list.
- [ ] **Step 4: Run tests, verify pass.**
- [ ] **Step 5: Commit** — `feat(frontend): progress, body-weight, and history`.

---

### Task 6: Editors — exercise catalog, templates, cycle

**Files:**
- Create: `frontend/src/screens/editors/Exercises.tsx`, `frontend/src/screens/editors/Templates.tsx`, `frontend/src/screens/editors/CycleEditor.tsx`
- Test: `frontend/src/screens/editors/Exercises.test.tsx`, `frontend/src/screens/editors/Templates.test.tsx`, `frontend/src/screens/editors/CycleEditor.test.tsx`

**Interfaces:**
- Consumes: Task 2 client (`listExercises`, `createExercise`, `updateExercise`, `listTemplates`, `getTemplate`, `createTemplate`, `updateTemplate`, `deleteTemplate`, `getCycle`, `putCycle`).
- Produces: `/editors/exercises`, `/editors/templates`, `/editors/cycle` routes. `putCycle` sends `steps: [{kind, template_id?}]` — `template` steps require a `template_id`; `run`/`rest` steps must omit it (backend 422s otherwise).

- [ ] **Step 1: Write the failing tests**
  - `Exercises.test.tsx` — lists exercises grouped by `muscle_group`; create a custom one (asserts `createExercise` body); edit a name (asserts `updateExercise`).
  - `Templates.test.tsx` — create a template with an ordered exercise list (asserts order preserved in the `exercise_ids` body); edit replaces the list; delete calls `deleteTemplate`.
  - `CycleEditor.test.tsx::builds valid steps` — assembling Peito(template)→Corrida(run)→Descanso(rest) sends `putCycle` with `template_id` only on the template step and **absent** on run/rest. **(Review Focus: cycle step shape.)**
  - `CycleEditor.test.tsx::template step needs template_id` — the UI prevents adding a `template` step without choosing a template.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** the three editors following the prototype tokens, with the cycle editor enforcing the kind/template_id invariant client-side before calling `putCycle`.
- [ ] **Step 4: Run tests, verify pass.**
- [ ] **Step 5: Commit** — `feat(frontend): catalog, template, and cycle editors`.

---

### Task 7: PWA polish — manifest, icons, service worker, install, safe-area, pinned chrome, nav

**Files:**
- Create: `frontend/public/manifest.webmanifest`, `frontend/public/icons/icon-192.png`, `frontend/public/icons/icon-512.png`, `frontend/public/apple-touch-icon.png`, `frontend/src/components/TabBar.tsx`
- Modify: `frontend/index.html` (viewport-fit + iOS standalone meta + manifest link), `frontend/vite.config.ts` (`vite-plugin-pwa` config), `frontend/src/App.tsx` (mount `TabBar`, route layout, safe-area)
- Test: `frontend/src/components/TabBar.test.tsx`, `tests/test_pwa_assets.py` (or a frontend test asserting manifest fields)

**Interfaces:**
- Consumes: all screens/routes.
- Produces: a **fixed** bottom `TabBar` (Hoje · Progresso · Editar, ≥44px targets, safe-area-inset-bottom padding) and an installable PWA. The service worker precaches the app shell; it does **not** own workout durability (IndexedDB does). The rest timer (Task 4) is already pinned.

- [ ] **Step 1: Write the failing tests**
  - `TabBar.test.tsx` — renders the destinations, marks the active route, each target ≥44px, applies `env(safe-area-inset-bottom)` padding; it is `position: fixed`.
  - manifest test — `manifest.webmanifest` has `display:"standalone"`, `name`/`short_name`, `theme_color`, and `icons` referencing 192 and 512.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** the manifest + icons (generate simple teal monogram icons, the "1 life·track" mark from the prototype), the `vite-plugin-pwa` service worker (precache shell, `registerType:"autoUpdate"`), the iOS meta tags and `viewport-fit=cover` in `index.html`, and the fixed `TabBar`. Verify a production build (`vite build`) serves and installs; the inspector/Lighthouse installability check passes.
- [ ] **Step 4: Run tests, verify pass**; build the SPA and confirm FastAPI serves it from one origin (Task 1's static mount) with the API working via relative paths.
- [ ] **Step 5: Commit** — `feat(frontend): installable PWA shell — manifest, SW, safe-area, bottom nav`.

---

## Out of scope — Phase 2 (separate plan)

The embedded AI: `POST /ask` (server-side Anthropic Tool Runner over the existing read endpoints, `claude-opus-5-5` default, blocking response with a "pensando…" state) and the live "Perguntar à IA" UI that replaces the Phase-1 disabled placeholder. Not planned here.

## Self-review

- **Spec coverage:** Today (T3), live workout + offline sync (T4), progress/history + body weight (T5), editors (T6), PWA install/offline shell (T1+T7), single-service + dev proxy (T1), auth (T2), AI placeholder/Phase-2 boundary (T3 placeholder + Out-of-scope). All v1 Phase-1 spec goals map to a task. ✅
- **Step scan:** each step names a test (with assertions) or a signature/file; no "handle edge cases" filler. ✅
- **Type consistency:** the `types.ts` block mirrors the backend response models verbatim (checked against `app/routers/*.py`); session/set UUIDs are strings end to end; `last-set` is nullable; cycle steps use `kind` + optional `template_id`. ✅
- **Review Focus:** mid-workout drop + no-duplication (T4), última-vez exclude_session_id (T4), never-logged null (T3/T4), 401→login (T2), empty/first-run (T3/T5) — each has an owning test. ✅
- **Proportion:** signatures + test names, no component bodies; plan is a decision list, not a transcript. ✅
