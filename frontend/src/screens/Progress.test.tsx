import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

// --- Mocks (hoisted before imports) ---

vi.mock('../api/client', () => ({
  getProgress: vi.fn(),
  listBodyweight: vi.fn(),
  logBodyweight: vi.fn(),
  listSessions: vi.fn(),
  listExercises: vi.fn(),
  listTemplates: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message = 'Unauthorized') {
      super(message)
      this.name = 'AuthError'
    }
  },
}))

import * as client from '../api/client'
import Progress from './Progress'

function renderProgress() {
  return render(
    <MemoryRouter>
      <Progress />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Progress screen', () => {
  describe('progress chart from series', () => {
    it('renders 3 plotted points and the top-weight axis', async () => {
      vi.mocked(client.listExercises).mockResolvedValueOnce([
        { id: 1, name: 'Supino', muscle_group: 'chest', description: null, is_custom: false },
      ])
      vi.mocked(client.getProgress).mockResolvedValueOnce([
        { date: '2024-01-01', top_weight: 60, total_reps: 24 },
        { date: '2024-02-01', top_weight: 65, total_reps: 24 },
        { date: '2024-03-01', top_weight: 70, total_reps: 24 },
      ])
      vi.mocked(client.listBodyweight).mockResolvedValueOnce([])
      vi.mocked(client.listSessions).mockResolvedValueOnce([])
      vi.mocked(client.listTemplates).mockResolvedValueOnce([])

      renderProgress()

      await waitFor(() => {
        expect(screen.getAllByTestId('progress-point')).toHaveLength(3)
      })

      // The ProgressChart SVG has role="img" and aria-label containing "peso máximo"
      expect(screen.getByRole('img', { name: /peso máximo/i })).toBeInTheDocument()
    })
  })

  describe('empty progress', () => {
    it('shows honest empty chart frame and not a crash', async () => {
      vi.mocked(client.listExercises).mockResolvedValueOnce([
        { id: 1, name: 'Supino', muscle_group: 'chest', description: null, is_custom: false },
      ])
      vi.mocked(client.getProgress).mockResolvedValueOnce([])
      vi.mocked(client.listBodyweight).mockResolvedValueOnce([])
      vi.mocked(client.listSessions).mockResolvedValueOnce([])
      vi.mocked(client.listTemplates).mockResolvedValueOnce([])

      renderProgress()

      await waitFor(() => {
        expect(screen.getByText(/sem histórico ainda/i)).toBeInTheDocument()
      })
    })
  })

  describe('bodyweight chart + log', () => {
    it('renders bw points, blocks weight ≤ 0, calls logBodyweight on valid submit', async () => {
      vi.mocked(client.listExercises).mockResolvedValueOnce([
        { id: 1, name: 'Supino', muscle_group: 'chest', description: null, is_custom: false },
      ])
      vi.mocked(client.getProgress).mockResolvedValueOnce([])
      vi.mocked(client.listBodyweight).mockResolvedValue([
        { id: 1, recorded_at: '2024-01-01T10:00:00Z', weight: 80 },
        { id: 2, recorded_at: '2024-02-01T10:00:00Z', weight: 79 },
        { id: 3, recorded_at: '2024-03-01T10:00:00Z', weight: 78 },
      ])
      vi.mocked(client.listSessions).mockResolvedValueOnce([])
      vi.mocked(client.listTemplates).mockResolvedValueOnce([])
      vi.mocked(client.logBodyweight).mockResolvedValue({
        id: 4,
        recorded_at: new Date().toISOString(),
        weight: 77.5,
      })

      renderProgress()

      // Wait for body weight points to render (3 points from ascending list)
      await waitFor(() => {
        expect(screen.getAllByTestId('bw-point')).toHaveLength(3)
      })

      // The input is a spinbutton (type="number") — only one on the page
      const input = screen.getByRole('spinbutton')
      const submitBtn = screen.getByRole('button', { name: /registrar/i })

      // weight 0 is blocked client-side
      await userEvent.clear(input)
      await userEvent.type(input, '0')
      await userEvent.click(submitBtn)
      expect(client.logBodyweight).not.toHaveBeenCalled()

      // negative weight is blocked client-side
      await userEvent.clear(input)
      await userEvent.type(input, '-5')
      await userEvent.click(submitBtn)
      expect(client.logBodyweight).not.toHaveBeenCalled()

      // valid weight triggers logBodyweight
      await userEvent.clear(input)
      await userEvent.type(input, '77.5')
      await userEvent.click(submitBtn)
      await waitFor(() => {
        expect(client.logBodyweight).toHaveBeenCalledWith(77.5)
      })

      // chart refreshes after successful log — listBodyweight is called twice
      // (once on initial load, once after the log succeeds)
      expect(client.listBodyweight).toHaveBeenCalledTimes(2)
    })
  })

  describe('log failure', () => {
    it('preserves the input value and shows an error when logBodyweight rejects', async () => {
      vi.mocked(client.listExercises).mockResolvedValueOnce([
        { id: 1, name: 'Supino', muscle_group: 'chest', description: null, is_custom: false },
      ])
      vi.mocked(client.getProgress).mockResolvedValueOnce([])
      vi.mocked(client.listBodyweight).mockResolvedValueOnce([])
      vi.mocked(client.listSessions).mockResolvedValueOnce([])
      vi.mocked(client.listTemplates).mockResolvedValueOnce([])
      vi.mocked(client.logBodyweight).mockRejectedValueOnce(new Error('Network error'))

      renderProgress()

      // Wait for the form to appear
      await waitFor(() => {
        expect(screen.getByRole('spinbutton')).toBeInTheDocument()
      })

      const input = screen.getByRole('spinbutton')
      await userEvent.clear(input)
      await userEvent.type(input, '77.5')
      await userEvent.click(screen.getByRole('button', { name: /registrar/i }))

      await waitFor(() => {
        // Error message is shown inline
        expect(screen.getByRole('alert')).toBeInTheDocument()
        // Input value is preserved — user can correct and retry
        expect(input).toHaveValue(77.5)
      })
    })
  })

  describe('history list', () => {
    it('shows sessions most-recent-first with date and template name', async () => {
      vi.mocked(client.listExercises).mockResolvedValueOnce([
        { id: 1, name: 'Supino', muscle_group: 'chest', description: null, is_custom: false },
      ])
      vi.mocked(client.getProgress).mockResolvedValueOnce([])
      vi.mocked(client.listBodyweight).mockResolvedValueOnce([])
      // listSessions returns most-recent-first (per API contract)
      vi.mocked(client.listSessions).mockResolvedValueOnce([
        {
          id: 'session-2',
          started_at: '2024-02-10T10:00:00Z',
          template_id: 2,
          finished_at: '2024-02-10T11:00:00Z',
          sets: [],
        },
        {
          id: 'session-1',
          started_at: '2024-01-15T10:00:00Z',
          template_id: 1,
          finished_at: '2024-01-15T11:00:00Z',
          sets: [],
        },
      ])
      vi.mocked(client.listTemplates).mockResolvedValueOnce([
        { id: 1, name: 'Peito', exercises: [] },
        { id: 2, name: 'Costas', exercises: [] },
      ])

      renderProgress()

      await waitFor(() => {
        const items = screen.getAllByRole('listitem')
        // Most recent (session-2: Costas) is first
        expect(items[0]).toHaveTextContent('Costas')
        // Older (session-1: Peito) is second
        expect(items[1]).toHaveTextContent('Peito')
      })
    })
  })
})
