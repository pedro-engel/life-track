import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearDraft, loadDraft, startWorkout, upsertSet } from './localStore'
import type { WorkoutDraftSet } from './localStore'

beforeEach(async () => {
  await clearDraft()
})

afterEach(async () => {
  await clearDraft()
})

describe('localStore', () => {
  it('set edits persist — loadDraft after upsert returns draft with both sets and same id', async () => {
    const draft = await startWorkout(1)

    const set1: WorkoutDraftSet = {
      id: 'set-uuid-1',
      exercise_id: 10,
      position: 1,
      weight: 60,
      reps: 8,
      note: null,
      completed: false,
    }
    const set2: WorkoutDraftSet = {
      id: 'set-uuid-2',
      exercise_id: 10,
      position: 2,
      weight: 65,
      reps: 6,
      note: null,
      completed: true,
    }

    await upsertSet(draft, set1)
    await upsertSet(draft, set2)

    // Simulate reload: loadDraft opens a fresh DB connection and reads persisted data
    const loaded = await loadDraft()

    expect(loaded).not.toBeNull()
    expect(loaded!.id).toBe(draft.id)
    expect(loaded!.sets).toHaveLength(2)
    expect(loaded!.sets.find(s => s.id === 'set-uuid-1')).toBeDefined()
    expect(loaded!.sets.find(s => s.id === 'set-uuid-2')).toBeDefined()
    expect(loaded!.sets.find(s => s.id === 'set-uuid-2')!.weight).toBe(65)
  })

  it('upsertSet replaces an existing set by id (idempotent in-memory)', async () => {
    const draft = await startWorkout(1)

    const set: WorkoutDraftSet = {
      id: 'set-uuid-1',
      exercise_id: 10,
      position: 1,
      weight: 60,
      reps: 8,
      note: null,
      completed: false,
    }

    await upsertSet(draft, set)

    const updated = { ...set, weight: 70, completed: true }
    await upsertSet(draft, updated)

    const loaded = await loadDraft()
    expect(loaded!.sets).toHaveLength(1)
    expect(loaded!.sets[0].weight).toBe(70)
    expect(loaded!.sets[0].completed).toBe(true)
  })

  it('clearDraft removes the draft so loadDraft returns null', async () => {
    const draft = await startWorkout(1)
    await upsertSet(draft, {
      id: 'set-uuid-1',
      exercise_id: 10,
      position: 1,
      weight: 60,
      reps: 8,
      note: null,
      completed: false,
    })

    await clearDraft()
    const loaded = await loadDraft()
    expect(loaded).toBeNull()
  })

  it('loadDraft returns null when no draft has been started', async () => {
    // clearDraft was already called in beforeEach, so the store is empty
    const loaded = await loadDraft()
    expect(loaded).toBeNull()
  })

  it('startWorkout creates a draft with a stable id and the given templateId', async () => {
    const draft = await startWorkout(42)
    expect(draft.id).toBeTruthy()
    expect(draft.template_id).toBe(42)
    expect(draft.sets).toEqual([])
    expect(draft.started_at).toBeTruthy()
  })
})
