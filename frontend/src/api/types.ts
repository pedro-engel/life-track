/** Exact backend response shapes — mirror the Python Pydantic models verbatim. */

export interface Exercise {
  id: number
  name: string
  muscle_group: string
  description: string | null
  is_custom: boolean
}

export interface TemplateResponse {
  id: number
  name: string
  exercises: Exercise[]
}

export interface StepResponse {
  position: number
  kind: 'template' | 'run' | 'rest'
  template_id: number | null
}

export interface CycleGetResponse {
  steps: StepResponse[]
  pointer: number
  next: StepResponse | null
}

export interface SetEntryOut {
  id: string
  session_id: string
  exercise_id: number
  position: number
  weight: number
  reps: number
  note: string | null
  completed: boolean
}

export interface SessionResponse {
  id: string
  started_at: string
  template_id: number | null
  finished_at: string | null
  sets: SetEntryOut[]
}

export type LastSet = {
  weight: number
  reps: number
  note: string | null
  session_date: string
} | null

export interface ProgressPoint {
  date: string
  top_weight: number
  total_reps: number
}

export interface BodyWeightOut {
  id: number
  recorded_at: string
  weight: number
}
