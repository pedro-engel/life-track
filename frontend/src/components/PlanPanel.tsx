import { Link } from 'react-router-dom'
import type { LastSet, TemplateResponse } from '../api/types'

interface ExerciseRowProps {
  name: string
  lastSet: LastSet | undefined
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
  /** Map from exerciseId → LastSet (may be null for never-logged exercises). */
  lastSets: Map<number, LastSet>
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
