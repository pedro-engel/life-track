import type { CycleGetResponse } from '../api/types'
import { stepLabel } from '../lib/cycle'

interface CycleCardsProps {
  cycle: CycleGetResponse
  /** Map from template_id → template name, for labelling template steps. */
  templateNames: Map<number, string>
}

/**
 * Horizontal scrollable row of cycle step cards.
 * Hoje card has teal accent; Amanhã card has lighter teal border.
 */
export function CycleCards({ cycle, templateNames }: CycleCardsProps) {
  if (cycle.steps.length === 0) return null

  return (
    <section aria-label="Ciclo de treino">
      <div className="cycle">
        {cycle.steps.map((step, index) => {
          const rel = (index - cycle.pointer + cycle.steps.length) % cycle.steps.length
          const when = rel === 0 ? 'Hoje' : rel === 1 ? 'Amanhã' : 'Depois'

          const name =
            step.template_id != null
              ? (templateNames.get(step.template_id) ?? stepLabel(step))
              : stepLabel(step)

          const isToday = rel === 0
          const isNext = rel === 1

          const classes = [
            'cyc',
            step.kind !== 'template' ? step.kind : '',
            isToday ? 'today' : isNext ? 'next' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div key={step.position} className={classes}>
              <div className="when">{when}</div>
              <div className="nm">{name}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
