import type { CycleGetResponse, StepResponse } from '../api/types'

/**
 * Returns the step immediately after the pointer in the cycle, wrapping around.
 * Returns null when the cycle has no steps.
 */
export function nextStep(cycle: CycleGetResponse): StepResponse | null {
  if (cycle.steps.length === 0) return null
  const nextIndex = (cycle.pointer + 1) % cycle.steps.length
  return cycle.steps[nextIndex]
}

/** Returns a display label for a step based on its kind. */
export function stepLabel(step: StepResponse): string {
  switch (step.kind) {
    case 'run':
      return 'Corrida'
    case 'rest':
      return 'Descanso'
    case 'template':
      return 'Treino'
  }
}
