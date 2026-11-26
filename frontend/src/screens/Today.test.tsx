import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/useAuth'

vi.mock('../api/client', () => ({
  getCycle: vi.fn(),
  getTemplate: vi.fn(),
  getLastSet: vi.fn(),
  listBodyweight: vi.fn(),
  listSessions: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message = 'Unauthorized') {
      super(message)
      this.name = 'AuthError'
    }
  },
}))

import * as client from '../api/client'
import Today from './Today'

function renderToday() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Today />
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('Today screen', () => {
  describe('greeting + hoje/amanhã', () => {
    beforeEach(() => {
      // Only fake Date — not setTimeout/setInterval, so waitFor still works
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-11-26T09:00:00'))
    })

    it('shows Bom dia greeting naming the day workout and renders Hoje/Amanhã cycle cards', async () => {
      vi.mocked(client.getCycle).mockResolvedValueOnce({
        steps: [
          { position: 0, kind: 'template', template_id: 1 },
          { position: 1, kind: 'template', template_id: 2 },
        ],
        pointer: 0,
        next: { position: 1, kind: 'template', template_id: 2 },
      })
      vi.mocked(client.getTemplate).mockImplementation(async (id) => {
        if (id === 1) return { id: 1, name: 'Peito', exercises: [] }
        return { id: 2, name: 'Costas', exercises: [] }
      })
      vi.mocked(client.listBodyweight).mockResolvedValueOnce([])

      renderToday()

      await waitFor(() => {
        // Greeting heading says Bom dia
        expect(screen.getByText(/bom dia/i)).toBeInTheDocument()
        // Greeting line names today's workout — appears in multiple places
        expect(screen.getAllByText(/peito/i).length).toBeGreaterThan(0)
      })

      // Cycle cards: "Hoje" label present, "Amanhã" label present, Costas shown
      // /hoje/i also matches "Treino de hoje" in plan panel — use getAllByText
      expect(screen.getAllByText(/hoje/i).length).toBeGreaterThan(0)
      expect(screen.getByText(/amanhã/i)).toBeInTheDocument()
      expect(screen.getByText(/costas/i)).toBeInTheDocument()
    })
  })

  describe('plan shows última vez e primeira vez', () => {
    beforeEach(() => {
      // Only fake Date — not setTimeout/setInterval, so waitFor still works
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-11-26T09:00:00'))
    })

    it('shows "última vez" when getLastSet returns a value and "primeira vez" when null', async () => {
      vi.mocked(client.getCycle).mockResolvedValueOnce({
        steps: [
          { position: 0, kind: 'template', template_id: 1 },
          { position: 1, kind: 'template', template_id: 2 },
        ],
        pointer: 0,
        next: { position: 1, kind: 'template', template_id: 2 },
      })
      vi.mocked(client.getTemplate).mockImplementation(async (id) => {
        if (id === 1)
          return {
            id: 1,
            name: 'Peito',
            exercises: [
              { id: 10, name: 'Supino', muscle_group: 'chest', description: null, is_custom: false },
              { id: 11, name: 'Crucifixo', muscle_group: 'chest', description: null, is_custom: false },
            ],
          }
        return { id: 2, name: 'Costas', exercises: [] }
      })
      vi.mocked(client.getLastSet).mockImplementation(async (exerciseId) => {
        if (exerciseId === 10)
          return { weight: 60, reps: 8, note: null, session_date: '2024-01-01' }
        return null
      })
      vi.mocked(client.listBodyweight).mockResolvedValueOnce([])

      renderToday()

      await waitFor(() => {
        expect(screen.getByText(/última vez: 60 kg × 8/)).toBeInTheDocument()
      })
      expect(screen.getByText(/primeira vez/i)).toBeInTheDocument()
    })
  })

  describe('run step renders marker, no template fetch', () => {
    it('shows Strava-style marker and does not call getTemplate for a run step', async () => {
      vi.mocked(client.getCycle).mockResolvedValueOnce({
        steps: [
          { position: 0, kind: 'run', template_id: null },
          { position: 1, kind: 'template', template_id: 1 },
        ],
        pointer: 0,
        next: { position: 1, kind: 'template', template_id: 1 },
      })
      vi.mocked(client.listBodyweight).mockResolvedValueOnce([])

      renderToday()

      await waitFor(() => {
        expect(screen.getByText(/registrada no strava/i)).toBeInTheDocument()
      })
      expect(vi.mocked(client.getTemplate)).not.toHaveBeenCalled()
    })
  })

  describe('empty cycle state', () => {
    it('shows honest empty state with link to cycle editor', async () => {
      vi.mocked(client.getCycle).mockResolvedValueOnce({
        steps: [],
        pointer: 0,
        next: null,
      })

      renderToday()

      await waitFor(() => {
        expect(screen.getByText(/monte seu ciclo/i)).toBeInTheDocument()
      })
      const link = screen.getByRole('link', { name: /monte seu ciclo/i })
      expect(link).toBeInTheDocument()
    })
  })
})
