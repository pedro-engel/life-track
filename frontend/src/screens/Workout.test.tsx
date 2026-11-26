import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mocks (hoisted before imports) ---

vi.mock('../api/client', () => ({
  getTemplate: vi.fn(),
  getLastSet: vi.fn(),
  advanceCycle: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message = 'Unauthorized') {
      super(message)
      this.name = 'AuthError'
    }
  },
}))

vi.mock('../workout/localStore', () => ({
  loadDraft: vi.fn(),
  startWorkout: vi.fn(),
  upsertSet: vi.fn(),
  clearDraft: vi.fn(),
}))

vi.mock('../workout/sync', () => ({
  flush: vi.fn(),
}))

import * as client from '../api/client'
import * as localStore from '../workout/localStore'
import * as sync from '../workout/sync'
import RestTimer from '../components/RestTimer'
import Workout from './Workout'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockDraft = {
  id: 'active-session-id',
  started_at: '2026-01-01T10:00:00.000Z',
  template_id: 1,
  sets: [] as Array<{
    id: string
    exercise_id: number
    position: number
    weight: number
    reps: number
    note: string | null
    completed: boolean
  }>,
}

const mockTemplate = {
  id: 1,
  name: 'Peito',
  exercises: [
    {
      id: 10,
      name: 'Supino reto',
      muscle_group: 'chest',
      description: null,
      is_custom: false,
    },
  ],
}

function renderWorkout(state = { templateId: 1, stepPosition: 0 }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/workout', state }]}>
      <Routes>
        <Route path="/workout" element={<Workout />} />
        <Route path="/" element={<div data-testid="today-screen">Today</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Workout screen', () => {
  beforeEach(() => {
    vi.mocked(localStore.loadDraft).mockResolvedValue(null)
    vi.mocked(localStore.startWorkout).mockResolvedValue({ ...mockDraft, sets: [] })
    vi.mocked(localStore.upsertSet).mockResolvedValue(undefined)
    vi.mocked(localStore.clearDraft).mockResolvedValue(undefined)
    vi.mocked(client.getTemplate).mockResolvedValue(mockTemplate)
    vi.mocked(client.getLastSet).mockResolvedValue({
      weight: 60,
      reps: 8,
      note: null,
      session_date: '2024-01-01',
    })
  })

  describe('última-vez uses exclude_session_id', () => {
    it('calls getLastSet with the active draft id as excludeSessionId', async () => {
      renderWorkout()

      await waitFor(() => {
        expect(vi.mocked(client.getLastSet)).toHaveBeenCalledWith(
          10,
          1,
          'active-session-id',
        )
      })
    })
  })

  describe('primeira vez', () => {
    it('shows "primeira vez" placeholder when getLastSet returns null', async () => {
      vi.mocked(client.getLastSet).mockResolvedValue(null)

      renderWorkout()

      await waitFor(() => {
        expect(screen.getByText(/primeira vez/i)).toBeInTheDocument()
      })
    })

    it('does not show a spinner when getLastSet returns null', async () => {
      vi.mocked(client.getLastSet).mockResolvedValue(null)

      renderWorkout()

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
        expect(screen.getByText(/primeira vez/i)).toBeInTheDocument()
      })
    })
  })

  describe('finish flushes and advances', () => {
    it('calls flush then advanceCycle then clearDraft in order, then navigates to Today', async () => {
      const callOrder: string[] = []

      vi.mocked(sync.flush).mockImplementation(async () => {
        callOrder.push('flush')
        return {
          id: 'active-session-id',
          started_at: '2026-01-01T10:00:00.000Z',
          template_id: 1,
          finished_at: '2026-01-01T11:00:00.000Z',
          sets: [],
        }
      })
      vi.mocked(client.advanceCycle).mockImplementation(async () => {
        callOrder.push('advanceCycle')
        return { pointer: 1 }
      })
      vi.mocked(localStore.clearDraft).mockImplementation(async () => {
        callOrder.push('clearDraft')
      })

      renderWorkout({ templateId: 1, stepPosition: 2 })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /finalizar treino/i })).toBeInTheDocument()
      })

      await userEvent.click(screen.getByRole('button', { name: /finalizar treino/i }))

      await waitFor(() => {
        expect(callOrder).toEqual(['flush', 'advanceCycle', 'clearDraft'])
      })

      // advanceCycle is called with the cycle step position (2)
      expect(vi.mocked(client.advanceCycle)).toHaveBeenCalledWith(2)

      // After finish, navigate to Today
      await waitFor(() => {
        expect(screen.getByTestId('today-screen')).toBeInTheDocument()
      })
    })
  })

  describe('shows última vez hint when last set exists', () => {
    it('renders the reference weight and reps from getLastSet', async () => {
      renderWorkout()

      await waitFor(() => {
        expect(screen.getByText(/60/)).toBeInTheDocument()
      })
    })
  })

  // -------------------------------------------------------------------------
  // Bug 2 regression: double-tap "Finalizar" must not advance the cycle twice
  // -------------------------------------------------------------------------
  describe('finish guard — double-tap prevention', () => {
    const mockResponse = {
      id: 'active-session-id',
      started_at: '2026-01-01T10:00:00.000Z',
      template_id: 1,
      finished_at: '2026-01-01T11:00:00.000Z',
      sets: [] as never[],
    }

    it('Finalizar button is disabled while finish is in-flight', async () => {
      let resolveFlush!: (v: typeof mockResponse) => void
      vi.mocked(sync.flush).mockImplementationOnce(
        () => new Promise<typeof mockResponse>((r) => { resolveFlush = r }),
      )
      vi.mocked(client.advanceCycle).mockResolvedValue({ pointer: 1 })

      renderWorkout({ templateId: 1, stepPosition: 0 })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /finalizar treino/i })).toBeInTheDocument()
      })

      // Click — flush is pending, handleFinish is suspended
      await userEvent.click(screen.getByRole('button', { name: /finalizar treino/i }))

      // Button must be disabled (status:'finishing')
      expect(screen.getByRole('button', { name: /finalizando/i })).toBeDisabled()

      // Resolve flush and let the finish complete
      act(() => { resolveFlush(mockResponse) })

      await waitFor(() => {
        expect(screen.getByTestId('today-screen')).toBeInTheDocument()
      })

      // advanceCycle called exactly once — no double-advance
      expect(vi.mocked(client.advanceCycle)).toHaveBeenCalledTimes(1)
    })

    it('a second programmatic finish attempt while in-flight is a no-op', async () => {
      let resolveFlush!: (v: typeof mockResponse) => void
      vi.mocked(sync.flush).mockImplementation(
        () => new Promise<typeof mockResponse>((r) => { resolveFlush = r }),
      )
      vi.mocked(client.advanceCycle).mockResolvedValue({ pointer: 1 })

      renderWorkout({ templateId: 1, stepPosition: 0 })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /finalizar treino/i })).toBeInTheDocument()
      })

      // First tap
      await userEvent.click(screen.getByRole('button', { name: /finalizar treino/i }))

      // Button is disabled; flush has been called once
      expect(vi.mocked(sync.flush)).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: /finalizando/i })).toBeDisabled()

      // Resolve the finish
      act(() => { resolveFlush(mockResponse) })

      await waitFor(() => {
        expect(screen.getByTestId('today-screen')).toBeInTheDocument()
      })

      // Still exactly one flush and one advanceCycle call
      expect(vi.mocked(sync.flush)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(client.advanceCycle)).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------------------------
  // Bug 3 regression: online event after finish must not cause extra reflush
  // -------------------------------------------------------------------------
  describe('online-event reflush guard', () => {
    const mockResponse = {
      id: 'active-session-id',
      started_at: '2026-01-01T10:00:00.000Z',
      template_id: 1,
      finished_at: '2026-01-01T11:00:00.000Z',
      sets: [] as never[],
    }

    it('online event while finish is in-flight does not trigger an extra flush', async () => {
      let resolveFlush!: (v: typeof mockResponse) => void
      vi.mocked(sync.flush).mockImplementationOnce(
        () => new Promise<typeof mockResponse>((r) => { resolveFlush = r }),
      )
      vi.mocked(client.advanceCycle).mockResolvedValue({ pointer: 1 })

      renderWorkout({ templateId: 1, stepPosition: 0 })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /finalizar treino/i })).toBeInTheDocument()
      })

      // Start finish — flush is pending; draftSnap.current is now null
      await userEvent.click(screen.getByRole('button', { name: /finalizar treino/i }))

      // Dispatch online event while the finish is in-flight.
      // The online handler checks `if (draftSnap.current)` — which is now null
      // → no extra flush call.
      act(() => { window.dispatchEvent(new Event('online')) })

      // Only the finish flush — no opportunistic extra flush
      expect(vi.mocked(sync.flush)).toHaveBeenCalledTimes(1)

      // Complete the finish
      act(() => { resolveFlush(mockResponse) })

      await waitFor(() => {
        expect(screen.getByTestId('today-screen')).toBeInTheDocument()
      })

      // Still only 1 flush total
      expect(vi.mocked(sync.flush)).toHaveBeenCalledTimes(1)
    })
  })
})

// ---------------------------------------------------------------------------
// RestTimer component tests
// ---------------------------------------------------------------------------

describe('RestTimer', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders time in MM:SS format', () => {
    const onSkip = vi.fn()
    render(<RestTimer seconds={90} onSkip={onSkip} />)
    expect(screen.getByText('1:30')).toBeInTheDocument()
  })

  it('"Pular" button calls onSkip', async () => {
    const onSkip = vi.fn()
    render(<RestTimer seconds={90} onSkip={onSkip} />)

    await userEvent.click(screen.getByRole('button', { name: /pular/i }))
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('counts down by 1 second each tick', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const onSkip = vi.fn()

    render(<RestTimer seconds={90} onSkip={onSkip} />)

    expect(screen.getByText('1:30')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByText('1:29')).toBeInTheDocument()
  })

  it('calls onSkip when timer reaches 0', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const onSkip = vi.fn()

    render(<RestTimer seconds={1} onSkip={onSkip} />)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onSkip).toHaveBeenCalled()
  })

  /**
   * Bug 1 regression: when the parent re-renders (e.g. forceUpdate from
   * updateSet) and passes a new `onSkip` function reference, the countdown
   * must NOT stall. The timer started at t=0 must still fire at t=1000ms even
   * if `onSkip` changed at t=500ms.
   */
  it('countdown keeps its pace when onSkip prop identity changes mid-interval', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    const { rerender } = render(<RestTimer seconds={5} onSkip={vi.fn()} />)
    expect(screen.getByText('0:05')).toBeInTheDocument()

    // Advance 500ms — first tick hasn't fired yet (timer is at 1000ms)
    act(() => { vi.advanceTimersByTime(500) })
    expect(screen.getByText('0:05')).toBeInTheDocument()

    // Simulate parent re-render with a new function reference (like forceUpdate() does)
    rerender(<RestTimer seconds={5} onSkip={vi.fn()} />)
    expect(screen.getByText('0:05')).toBeInTheDocument()

    // Advance another 500ms (1000ms total from start).
    // With the BUG (onSkip in effect deps): timer was restarted at t=500ms, fires at
    //   t=1500ms — another 500ms is not enough → still shows 0:05.
    // With the FIX (onSkip via ref, NOT in effect deps): original timer fires at
    //   t=1000ms → remaining becomes 4 → shows 0:04.
    act(() => { vi.advanceTimersByTime(500) })
    expect(screen.getByText('0:04')).toBeInTheDocument()
  })
})
