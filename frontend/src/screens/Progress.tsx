import { useEffect, useState } from 'react'
import {
  getProgress,
  listBodyweight,
  listExercises,
  listSessions,
  listTemplates,
  logBodyweight,
} from '../api/client'
import type { BodyWeightOut, Exercise, ProgressPoint, SessionResponse } from '../api/types'
import { BodyWeightChart } from '../components/BodyWeightChart'
import { HistoryList } from '../components/HistoryList'
import { LogBodyWeight } from '../components/LogBodyWeight'
import { ProgressChart } from '../components/ProgressChart'

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

type ScreenState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready'
      exercises: Exercise[]
      bwEntries: BodyWeightOut[]
      sessions: SessionResponse[]
      templateNames: Map<number, string>
    }

// ---------------------------------------------------------------------------
// Progress screen
// ---------------------------------------------------------------------------

export default function Progress() {
  const [screenState, setScreenState] = useState<ScreenState>({ status: 'loading' })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [progressPoints, setProgressPoints] = useState<ProgressPoint[]>([])

  // ----- Initial parallel load -----
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [exercises, bwEntries, sessions, templates] = await Promise.all([
          listExercises(),
          listBodyweight(),
          listSessions(),
          listTemplates(),
        ])

        if (cancelled) return

        const templateNames = new Map<number, string>(templates.map(t => [t.id, t.name]))

        setScreenState({ status: 'ready', exercises, bwEntries, sessions, templateNames })

        // Auto-select the first exercise; triggers the progress effect below.
        if (exercises.length > 0) {
          setSelectedId(exercises[0].id)
        }
      } catch {
        // AuthError triggers auth:unauthorized → AuthProvider → redirect to /login.
        // Other errors show an error state rather than crashing.
        if (!cancelled) setScreenState({ status: 'error' })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  // ----- Load progress when selected exercise changes -----
  useEffect(() => {
    if (selectedId == null) return

    let cancelled = false

    async function loadProgress() {
      try {
        const pts = await getProgress(selectedId!)
        if (!cancelled) setProgressPoints(pts)
      } catch {
        if (!cancelled) setProgressPoints([])
      }
    }

    loadProgress()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  // ----- Shared x-axis range (union of both series' dates) -----
  const bwEntries = screenState.status === 'ready' ? screenState.bwEntries : []

  const allTimestamps = [
    ...progressPoints.map(p => new Date(p.date).getTime()),
    ...bwEntries.map(e => new Date(e.recorded_at).getTime()),
  ]
  const xMin =
    allTimestamps.length > 0 ? new Date(Math.min(...allTimestamps)) : new Date()
  const xMax =
    allTimestamps.length > 0 ? new Date(Math.max(...allTimestamps)) : new Date()

  // ----- Log body weight and refresh -----
  async function handleLog(weight: number) {
    await logBodyweight(weight)
    // Refresh body-weight entries
    if (screenState.status !== 'ready') return
    try {
      const updated = await listBodyweight()
      setScreenState(prev =>
        prev.status === 'ready' ? { ...prev, bwEntries: updated } : prev,
      )
    } catch {
      // If refresh fails, leave the stale data — user can reload
    }
  }

  // ----- Render -----

  if (screenState.status === 'loading') {
    return (
      <main className="content">
        <p style={{ color: 'var(--muted)' }}>Carregando…</p>
      </main>
    )
  }

  if (screenState.status === 'error') {
    return (
      <main className="content">
        <p style={{ color: 'var(--muted)' }}>Algo deu errado. Tente novamente.</p>
      </main>
    )
  }

  const { exercises, sessions, templateNames } = screenState

  return (
    <main className="content">
      {/* ----- Page heading ----- */}
      <section>
        <h1
          style={{
            fontFamily: 'var(--serif)',
            fontWeight: 400,
            fontSize: '24px',
            margin: 0,
            color: 'var(--text)',
          }}
        >
          Progresso
        </h1>
      </section>

      {/* ----- Exercise selector + progress chart ----- */}
      <section className="panel" aria-label="Progressão de exercício">
        <header>
          <h2>Evolução</h2>
        </header>

        {exercises.length > 0 ? (
          <select
            value={selectedId ?? ''}
            onChange={e => {
              setSelectedId(Number(e.target.value))
              setProgressPoints([]) // reset while new series loads
            }}
            style={{
              width: '100%',
              height: 36,
              padding: '0 10px',
              border: '1px solid var(--control)',
              borderRadius: 'var(--radius-control)',
              fontFamily: 'var(--font)',
              fontSize: 'var(--fs-body)',
              background: 'var(--ground)',
              color: 'var(--text)',
              marginBottom: 12,
            }}
          >
            {exercises.map(ex => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: 'var(--fs-body)', margin: '0 0 12px' }}>
            Nenhum exercício cadastrado.
          </p>
        )}

        <ProgressChart points={progressPoints} xMin={xMin} xMax={xMax} />
      </section>

      {/* ----- Body weight chart + logger ----- */}
      <section className="panel" aria-label="Peso corporal">
        <header>
          <h2>Peso corporal</h2>
        </header>

        <BodyWeightChart entries={bwEntries} xMin={xMin} xMax={xMax} />
        <LogBodyWeight onLog={handleLog} />
      </section>

      {/* ----- Session history ----- */}
      <section className="panel" aria-label="Histórico de treinos">
        <header>
          <h2>Histórico</h2>
        </header>

        <HistoryList sessions={sessions} templateNames={templateNames} />
      </section>
    </main>
  )
}
