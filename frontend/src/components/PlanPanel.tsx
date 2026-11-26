import { Link } from 'react-router-dom'
import type { LastSet, TemplateResponse } from '../api/types'

interface ExerciseRowProps {
  name: string
  /** null = never logged (primeira vez); undefined = not in map (safe fallback = primeira vez). */
  lastSet: LastSet | null | undefined
}

function ExerciseRow({ name, lastSet }: ExerciseRowProps) {
  return (
    <div className="ex">
      <div className="main">
        <div className="nm">{name}</div>
        {lastSet != null ? (
          <div className="last">
            última vez: {lastSet.weight} kg × {lastSet.reps}
          </div>
        ) : (
          <div className="last none">primeira vez</div>
        )}
      </div>
    </div>
  )
}

interface PlanPanelProps {
  template: TemplateResponse
  /**
   * Map from exerciseId → last set data.
   * null means the exercise has never been logged (primeira vez).
   * undefined (missing key) is treated the same as null.
   */
  lastSets: Map<number, LastSet | null>
}

/**
 * Plan panel: today's template exercises with reference weights.
 * Shown for template-kind steps in the morning view.
 */
export function PlanPanel({ template, lastSets }: PlanPanelProps) {
  return (
    <section className="panel">
      <header>
        <h2>
          Treino de hoje · {template.name}
        </h2>
        <span className="meta">{template.exercises.length} exercícios</span>
      </header>
      <div className="exs">
        {template.exercises.map((ex) => (
          <ExerciseRow
            key={ex.id}
            name={ex.name}
            lastSet={lastSets.get(ex.id)}
          />
        ))}
      </div>
      <div style={{ marginTop: '16px' }}>
        <Link to="/workout" className="cta accent">
          Iniciar treino
        </Link>
      </div>
    </section>
  )
}
