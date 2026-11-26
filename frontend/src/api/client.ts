import { clearToken, getToken, setToken } from '../auth/token'
import type {
  BodyWeightOut,
  CycleGetResponse,
  Exercise,
  LastSet,
  ProgressPoint,
  SessionResponse,
  TemplateResponse,
} from './types'

/** Thrown when any API call receives a 401 — expired or missing token. */
export class AuthError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'AuthError'
  }
}

/** Core fetch wrapper. Attaches bearer, normalises errors, throws AuthError on 401. */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    baseHeaders['Authorization'] = `Bearer ${token}`
  }
  const headers: Record<string, string> = {
    ...baseHeaders,
    ...((options.headers as Record<string, string>) ?? {}),
  }

  const res = await fetch(path, { ...options, headers })

  if (res.status === 401) {
    clearToken()
    // Notify AuthProvider (and any other listeners) so they can flip auth state
    // and redirect to /login — works from any mounted screen without coupling.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }
    throw new AuthError()
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** POST /auth/login — stores the returned JWT in localStorage and returns it. */
export async function login(password: string): Promise<string> {
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })

  if (res.status === 401) {
    clearToken()
    throw new AuthError('Incorrect password')
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const data = (await res.json()) as { token: string }
  setToken(data.token)
  return data.token
}

// ---------------------------------------------------------------------------
// Cycle
// ---------------------------------------------------------------------------

export function getCycle(): Promise<CycleGetResponse> {
  return request<CycleGetResponse>('/cycle')
}

export function putCycle(
  steps: Array<{ kind: 'template' | 'run' | 'rest'; template_id?: number }>,
): Promise<CycleGetResponse> {
  return request<CycleGetResponse>('/cycle', {
    method: 'PUT',
    body: JSON.stringify({ steps }),
  })
}

export function advanceCycle(completedPosition: number): Promise<{ pointer: number }> {
  return request<{ pointer: number }>('/cycle/advance', {
    method: 'POST',
    body: JSON.stringify({ completed_step_position: completedPosition }),
  })
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function getTemplate(id: number): Promise<TemplateResponse> {
  return request<TemplateResponse>(`/templates/${id}`)
}

export function listTemplates(): Promise<TemplateResponse[]> {
  return request<TemplateResponse[]>('/templates')
}

export function createTemplate(name: string, exerciseIds: number[]): Promise<TemplateResponse> {
  return request<TemplateResponse>('/templates', {
    method: 'POST',
    body: JSON.stringify({ name, exercise_ids: exerciseIds }),
  })
}

export function updateTemplate(
  id: number,
  patch: { name?: string; exercise_ids?: number[] },
): Promise<TemplateResponse> {
  return request<TemplateResponse>(`/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export function deleteTemplate(id: number): Promise<void> {
  return request<void>(`/templates/${id}`, { method: 'DELETE' })
}

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

export function listExercises(muscleGroup?: string): Promise<Exercise[]> {
  const params = muscleGroup ? `?muscle_group=${encodeURIComponent(muscleGroup)}` : ''
  return request<Exercise[]>(`/exercises${params}`)
}

export function createExercise(data: {
  name: string
  muscle_group: string
  description?: string
}): Promise<Exercise> {
  return request<Exercise>('/exercises', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateExercise(
  id: number,
  patch: { name?: string; description?: string },
): Promise<Exercise> {
  return request<Exercise>(`/exercises/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

// ---------------------------------------------------------------------------
// Progress / last set
// ---------------------------------------------------------------------------

export function getLastSet(
  exerciseId: number,
  position: number,
  excludeSessionId?: string,
): Promise<LastSet> {
  let params = `?position=${position}`
  if (excludeSessionId) {
    params += `&exclude_session_id=${encodeURIComponent(excludeSessionId)}`
  }
  return request<LastSet>(`/exercises/${exerciseId}/last-set${params}`)
}

export function getProgress(exerciseId: number): Promise<ProgressPoint[]> {
  return request<ProgressPoint[]>(`/exercises/${exerciseId}/progress`)
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/** Input shape for each set when syncing a session — note is optional. */
export interface SetEntryIn {
  id: string
  exercise_id: number
  position: number
  weight: number
  reps: number
  note?: string | null
  completed: boolean
}

export interface SyncSessionPayload {
  session: {
    id: string
    started_at: string
    template_id?: number | null
    finished_at?: string | null
  }
  sets: SetEntryIn[]
}

export function syncSession(payload: SyncSessionPayload): Promise<SessionResponse> {
  return request<SessionResponse>('/sessions/sync', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listSessions(): Promise<SessionResponse[]> {
  return request<SessionResponse[]>('/sessions')
}

export function getSession(id: string): Promise<SessionResponse> {
  return request<SessionResponse>(`/sessions/${id}`)
}

// ---------------------------------------------------------------------------
// Body weight
// ---------------------------------------------------------------------------

export function listBodyweight(): Promise<BodyWeightOut[]> {
  return request<BodyWeightOut[]>('/bodyweight')
}

export function logBodyweight(weight: number, recordedAt?: string): Promise<BodyWeightOut> {
  return request<BodyWeightOut>('/bodyweight', {
    method: 'POST',
    body: JSON.stringify({ weight, ...(recordedAt ? { recorded_at: recordedAt } : {}) }),
  })
}
