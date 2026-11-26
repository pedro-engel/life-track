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
})
