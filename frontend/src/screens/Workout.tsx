import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { advanceCycle } from '../api/client'
import RestTimer from '../components/RestTimer'
import SetRow from '../components/SetRow'
import { clearDraft } from '../workout/localStore'
import { flush } from '../workout/sync'
import { useWorkout } from '../workout/useWorkout'

// ---------------------------------------------------------------------------
// Route state shape (passed from PlanPanel via <Link state={...}>)
// ---------------------------------------------------------------------------
interface WorkoutRouteState {
  templateId: number
  stepPosition: number
}

// ---------------------------------------------------------------------------
// Elapsed time display
// ---------------------------------------------------------------------------
function useElapsed(startedAt: string | null | undefined) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    if (!startedAt) return
    const start = new Date(startedAt).getTime()

    function update() {
      const diff = Math.max(0, Math.floor((Date.now() - start) / 1000))
      const h = Math.floor(diff / 3600)
      const m = Math.floor((diff % 3600) / 60)
      const s = diff % 60
      if (h > 0) {
        setElapsed(`${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`)
      } else {
        setElapsed(`${m}:${s.toString().padStart(2, '0')}`)
      }
    }

    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  return elapsed
}

// ---------------------------------------------------------------------------
// Workout screen
// ---------------------------------------------------------------------------

export default function Workout() {
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = (location.state ?? {}) as Partial<WorkoutRouteState>
  const templateId = routeState.templateId ?? null
  const stepPosition = routeState.stepPosition ?? 0

  const { state, updateSet, addSet, completeSet, skipRest, markFinishing, markFinishError } = useWorkout(templateId)
  const elapsed = useElapsed(state.draft?.started_at)

  // Wire the `online` event for opportunistic re-flush (best effort, not the tested path).
  // draftSnap is synced in the render body so the handler always reads the latest draft.
  const draftSnap = useRef(state.draft)
  draftSnap.current = state.draft
  // isFinishingRef gates the online handler independently of React's render cycle:
  // setting it in handleFinish is atomic and never overwritten by a re-render.
  const isFinishingRef = useRef(false)
  useEffect(() => {
    function handleOnline() {
      // Skip if finish is in-progress (isFinishingRef) or no draft to reflush.
      if (isFinishingRef.current || !draftSnap.current) return
      flush(draftSnap.current).catch(() => {
        // best-effort — ignore errors; finish-flush is the guaranteed path
      })
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  const [finishError, setFinishError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Finish handler
  // ---------------------------------------------------------------------------
  async function handleFinish() {
    if (!state.draft) return
    // Atomically guard against double-tap: returns false if already finishing.
    if (!markFinishing()) return

    // Set the finishing flag synchronously (before any await) so that any
    // online event that fires during the async finish sequence is blocked.
    // This ref is never overwritten by a re-render (unlike draftSnap.current).
    isFinishingRef.current = true
    setFinishError(null)

    const draft = state.draft
    const finishedAt = new Date().toISOString()
    try {
      await flush(draft, finishedAt)
      await advanceCycle(stepPosition)
      await clearDraft()
      navigate('/', { replace: true })
    } catch {
      isFinishingRef.current = false  // re-enable on error
      markFinishError()
      setFinishError('Não foi possível finalizar. Verifique sua conexão e tente novamente.')
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  if (state.status === 'loading') {
    return (
      <main className="content" aria-live="polite">
        <p style={{ color: 'var(--muted)' }}>Carregando…</p>
      </main>
    )
  }

  if (state.status === 'error' || !state.template) {
    return (
      <main className="content">
        <p style={{ color: 'var(--muted)' }}>Algo deu errado. Tente novamente.</p>
      </main>
    )
  }

  const { template, draft, lastSets, restSeconds } = state
  const isFinishing = state.status === 'finishing'

  return (
    <div className="app-phone" style={{ minHeight: '100svh' }}>
      {/* Top bar */}
      <header className="topbar">
        <button
          type="button"
          className="back"
          aria-label="Voltar"
          onClick={() => navigate('/', { replace: true })}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="ctx">
          <h1>{template.name}</h1>
          <span>em andamento · {elapsed}</span>
        </div>
        <button
          type="button"
          className="act"
          onClick={handleFinish}
          disabled={isFinishing}
        >
          {isFinishing ? 'Finalizando…' : 'Finalizar'}
        </button>
      </header>

      {/* Scrollable content */}
      <main
        className="content"
        style={{ paddingBottom: 'calc(84px + var(--safe-b, 0px))' }}
      >
        {/* Pinned rest timer */}
        {restSeconds !== null && (
          <RestTimer seconds={restSeconds} onSkip={skipRest} />
        )}

        {/* Exercise sections */}
        <div className="wo">
          {template.exercises.map((ex) => {
            const exSets = (draft?.sets ?? [])
              .filter((s) => s.exercise_id === ex.id)
              .sort((a, b) => a.position - b.position)
            const lastSet = lastSets.get(ex.id)

            return (
              <section key={ex.id} className="now">
                <h2>{ex.name}</h2>
                <p className="sub">
                  {lastSet != null
                    ? `última vez: ${lastSet.weight} kg × ${lastSet.reps}`
                    : 'primeira vez — sem referência'}
                  {' · '}
                  {exSets.length} {exSets.length === 1 ? 'série' : 'séries'}
                </p>
                <div className="sets">
                  {exSets.map((set, idx) => (
                    <SetRow
                      key={set.id}
                      set={set}
                      setNumber={idx + 1}
                      lastSet={lastSet}
                      onChange={updateSet}
                      onComplete={completeSet}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="addset"
                  onClick={() => addSet(ex.id)}
                >
                  + Adicionar série
                </button>
              </section>
            )
          })}
        </div>
      </main>

      {/* Sticky finish footer */}
      <div className="finish">
        {finishError && (
          <p
            role="alert"
            style={{ color: 'var(--negative)', fontSize: 'var(--fs-small)', marginBottom: '8px', textAlign: 'center' }}
          >
            {finishError}
          </p>
        )}
        <button
          type="button"
          className="cta"
          onClick={handleFinish}
          aria-label="Finalizar treino"
          disabled={isFinishing}
        >
          {isFinishing ? 'Finalizando…' : 'Finalizar treino'}
        </button>
      </div>
    </div>
  )
}
