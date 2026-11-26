import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/client', () => ({
  syncSession: vi.fn(),
}))

import * as client from '../api/client'
import { flush } from './sync'
import type { WorkoutDraft } from './localStore'

afterEach(() => {
  vi.clearAllMocks()
})

const baseDraft: WorkoutDraft = {
  id: 'session-uuid',
  started_at: '2026-01-01T10:00:00.000Z',
  template_id: 1,
  sets: [
    {
      id: 'set-uuid-1',
      exercise_id: 10,
      position: 1,
      weight: 60,
      reps: 8,
      note: null,
      completed: true,
    },
  ],
}

const mockSessionResponse = {
  id: 'session-uuid',
  started_at: '2026-01-01T10:00:00.000Z',
  template_id: 1,
  finished_at: null,
  sets: [],
}

describe('sync', () => {
  it('idempotent — two flushes send identical session id and set ids', async () => {
    vi.mocked(client.syncSession).mockResolvedValue(mockSessionResponse)

    await flush(baseDraft)
    await flush(baseDraft)

    expect(vi.mocked(client.syncSession)).toHaveBeenCalledTimes(2)

    const calls = vi.mocked(client.syncSession).mock.calls
    const [firstBody, secondBody] = [calls[0][0], calls[1][0]]

    // Session id must be identical across both calls (idempotent upsert)
    expect(firstBody.session.id).toBe(secondBody.session.id)
    expect(firstBody.session.id).toBe('session-uuid')

    // Set ids must be identical across both calls
    const firstSetIds = firstBody.sets.map((s: { id: string }) => s.id)
    const secondSetIds = secondBody.sets.map((s: { id: string }) => s.id)
    expect(firstSetIds).toEqual(secondSetIds)
    expect(firstSetIds[0]).toBe('set-uuid-1')
  })

  it('negative weight is clamped to 0 before posting', async () => {
    vi.mocked(client.syncSession).mockResolvedValue(mockSessionResponse)

    const draftWithNegativeWeight: WorkoutDraft = {
      ...baseDraft,
      sets: [
        {
          id: 'set-uuid-neg',
          exercise_id: 10,
          position: 1,
          weight: -1,
          reps: 8,
          note: null,
          completed: false,
        },
      ],
    }

    await flush(draftWithNegativeWeight)

    const [body] = vi.mocked(client.syncSession).mock.calls[0]
    expect(body.sets[0].weight).toBeGreaterThanOrEqual(0)
  })

  it('negative reps is clamped to 0 before posting', async () => {
    vi.mocked(client.syncSession).mockResolvedValue(mockSessionResponse)

    const draftWithNegativeReps: WorkoutDraft = {
      ...baseDraft,
      sets: [
        {
          id: 'set-uuid-neg',
          exercise_id: 10,
          position: 1,
          weight: 60,
          reps: -1,
          note: null,
          completed: false,
        },
      ],
    }

    await flush(draftWithNegativeReps)

    const [body] = vi.mocked(client.syncSession).mock.calls[0]
    expect(body.sets[0].reps).toBeGreaterThanOrEqual(0)
  })

  it('flush includes finished_at when provided', async () => {
    vi.mocked(client.syncSession).mockResolvedValue({
      ...mockSessionResponse,
      finished_at: '2026-01-01T11:00:00.000Z',
    })

    await flush(baseDraft, '2026-01-01T11:00:00.000Z')

    const [body] = vi.mocked(client.syncSession).mock.calls[0]
    expect(body.session.finished_at).toBe('2026-01-01T11:00:00.000Z')
  })

  it('flush sends null finished_at when not provided', async () => {
    vi.mocked(client.syncSession).mockResolvedValue(mockSessionResponse)

    await flush(baseDraft)

    const [body] = vi.mocked(client.syncSession).mock.calls[0]
    expect(body.session.finished_at).toBeNull()
  })
})
