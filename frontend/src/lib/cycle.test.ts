import { describe, expect, it } from 'vitest'
import { nextStep, stepLabel } from './cycle'
import type { CycleGetResponse, StepResponse } from '../api/types'

function tmpl(position: number, template_id: number): StepResponse {
  return { position, kind: 'template', template_id }
}

function run(position: number): StepResponse {
  return { position, kind: 'run', template_id: null }
}

function rest(position: number): StepResponse {
  return { position, kind: 'rest', template_id: null }
}

describe('nextStep', () => {
  it('returns the step after the pointer', () => {
    const cycle: CycleGetResponse = {
      steps: [tmpl(0, 1), tmpl(1, 2), tmpl(2, 3)],
      pointer: 0,
      next: null,
    }
    expect(nextStep(cycle)).toEqual(tmpl(1, 2))
  })

  it('wraps from last step back to first', () => {
    const cycle: CycleGetResponse = {
      steps: [tmpl(0, 1), tmpl(1, 2), tmpl(2, 3)],
      pointer: 2,
      next: null,
    }
    expect(nextStep(cycle)).toEqual(tmpl(0, 1))
  })

  it('returns null for empty cycle', () => {
    const cycle: CycleGetResponse = {
      steps: [],
      pointer: 0,
      next: null,
    }
    expect(nextStep(cycle)).toBeNull()
  })

  it('handles single-step cycle (wraps to itself)', () => {
    const cycle: CycleGetResponse = {
      steps: [tmpl(0, 1)],
      pointer: 0,
      next: null,
    }
    expect(nextStep(cycle)).toEqual(tmpl(0, 1))
  })
})

describe('stepLabel', () => {
  it('labels run steps as Corrida', () => {
    expect(stepLabel(run(0))).toBe('Corrida')
  })

  it('labels rest steps as Descanso', () => {
    expect(stepLabel(rest(0))).toBe('Descanso')
  })

  it('labels template steps as Treino fallback', () => {
    expect(stepLabel(tmpl(0, 1))).toBe('Treino')
  })
})
