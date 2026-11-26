import { syncSession } from '../api/client'
import type { SessionResponse } from '../api/types'
import type { WorkoutDraft } from './localStore'

/**
 * Build the POST /sessions/sync payload from the current draft and send it.
 * Uses the draft's stable UUIDs → safe to call repeatedly (backend upserts).
 * Clamps weight/reps to ≥ 0 so negatives never reach the wire (backend 422s on < 0).
 */
export async function flush(draft: WorkoutDraft, finishedAt?: string | null): Promise<SessionResponse> {
  const payload = {
    session: {
      id: draft.id,
      started_at: draft.started_at,
      template_id: draft.template_id,
      finished_at: finishedAt ?? draft.finished_at ?? null,
    },
    sets: draft.sets.map((s) => ({
      id: s.id,
      exercise_id: s.exercise_id,
      position: s.position,
      weight: Math.max(0, s.weight),
      reps: Math.max(0, s.reps),
      note: s.note,
      completed: s.completed,
    })),
  }
  return syncSession(payload)
}
