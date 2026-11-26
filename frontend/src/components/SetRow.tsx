import type { LastSet } from '../api/types'
import type { WorkoutDraftSet } from '../workout/localStore'

interface SetRowProps {
  set: WorkoutDraftSet
  setNumber: number
  /** null = primeira vez (never logged); undefined = not fetched yet. */
  lastSet: LastSet | null | undefined
  onChange: (updated: WorkoutDraftSet) => void
  onComplete: (setId: string) => void
}

/**
 * One set row: big 52px weight/reps inputs + última-vez hint + check button.
 * Prevents negative values from being sent to the caller (clamps to 0).
 * Ergonomics: all targets ≥ 44px.
 */
export default function SetRow({ set, setNumber, lastSet, onChange, onComplete }: SetRowProps) {
  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '' || raw === '-') return
    const value = parseFloat(raw)
    if (!isNaN(value)) {
      onChange({ ...set, weight: Math.max(0, value) })
    }
  }

  const handleRepsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '' || raw === '-') return
    const value = parseInt(raw, 10)
    if (!isNaN(value)) {
      onChange({ ...set, reps: Math.max(0, value) })
    }
  }

  const lastWeightStr = lastSet != null ? String(lastSet.weight) : null
  const lastRepsStr = lastSet != null ? String(lastSet.reps) : null

  return (
    <div className={`setrow${set.completed ? ' done' : ''}`}>
      <div className="n">{setNumber}</div>

      {/* Weight field */}
      <div className="fld">
        <label htmlFor={`weight-${set.id}`}>
          peso{' '}
          {lastWeightStr !== null ? (
            <span className="ref">· última {lastWeightStr}</span>
          ) : (
            <span className="ref none">· —</span>
          )}
        </label>
        <input
          id={`weight-${set.id}`}
          inputMode="decimal"
          aria-label={`Peso série ${setNumber}`}
          value={set.weight > 0 ? set.weight : ''}
          placeholder="kg"
          onChange={handleWeightChange}
        />
      </div>

      {/* Reps field */}
      <div className="fld">
        <label htmlFor={`reps-${set.id}`}>
          reps{' '}
          {lastRepsStr !== null ? (
            <span className="ref">· última {lastRepsStr}</span>
          ) : (
            <span className="ref none">· —</span>
          )}
        </label>
        <input
          id={`reps-${set.id}`}
          inputMode="numeric"
          aria-label={`Repetições série ${setNumber}`}
          value={set.reps > 0 ? set.reps : ''}
          placeholder="reps"
          onChange={handleRepsChange}
        />
      </div>

      {/* Complete button */}
      <button
        type="button"
        className="ok"
        aria-label={`Concluir série ${setNumber}`}
        aria-pressed={set.completed}
        onClick={() => onComplete(set.id)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </button>
    </div>
  )
}
