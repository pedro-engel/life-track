import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/client', () => ({
  listExercises: vi.fn(),
  createExercise: vi.fn(),
  updateExercise: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message = 'Unauthorized') {
      super(message)
      this.name = 'AuthError'
    }
  },
}))

import * as client from '../../api/client'
import Exercises from './Exercises'

function renderExercises() {
  return render(
    <MemoryRouter>
      <Exercises />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('Exercises editor', () => {
  describe('list grouped by muscle_group', () => {
    it('renders exercises grouped under their muscle_group heading', async () => {
      vi.mocked(client.listExercises).mockResolvedValueOnce([
        { id: 1, name: 'Supino', muscle_group: 'Peito', description: null, is_custom: false },
        { id: 2, name: 'Crucifixo', muscle_group: 'Peito', description: null, is_custom: false },
        { id: 3, name: 'Remada', muscle_group: 'Costas', description: null, is_custom: false },
      ])

      renderExercises()

      await waitFor(() => {
        expect(screen.getByText('Supino')).toBeInTheDocument()
      })

      expect(screen.getByText('Crucifixo')).toBeInTheDocument()
      expect(screen.getByText('Remada')).toBeInTheDocument()
      // Group headings
      expect(screen.getByText('Peito')).toBeInTheDocument()
      expect(screen.getByText('Costas')).toBeInTheDocument()
    })
  })

  describe('create a custom exercise', () => {
    it('calls createExercise with correct body and refreshes the list', async () => {
      vi.mocked(client.listExercises).mockResolvedValue([])
      vi.mocked(client.createExercise).mockResolvedValueOnce({
        id: 10,
        name: 'Leg Press',
        muscle_group: 'Pernas',
        description: null,
        is_custom: true,
      })

      renderExercises()

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /nome/i })).toBeInTheDocument()
      })

      const nameInput = screen.getByRole('textbox', { name: /nome/i })
      const groupInput = screen.getByRole('textbox', { name: /grupo muscular/i })
      const submitBtn = screen.getByRole('button', { name: /adicionar/i })

      await userEvent.type(nameInput, 'Leg Press')
      await userEvent.type(groupInput, 'Pernas')
      await userEvent.click(submitBtn)

      await waitFor(() => {
        expect(client.createExercise).toHaveBeenCalledWith({
          name: 'Leg Press',
          muscle_group: 'Pernas',
        })
      })

      // listExercises is refreshed after creating
      expect(client.listExercises).toHaveBeenCalledTimes(2)
    })
  })

  describe('edit exercise name', () => {
    it('calls updateExercise with the new name', async () => {
      vi.mocked(client.listExercises).mockResolvedValue([
        { id: 5, name: 'Supino Reto', muscle_group: 'Peito', description: null, is_custom: true },
      ])
      vi.mocked(client.updateExercise).mockResolvedValueOnce({
        id: 5,
        name: 'Supino Inclinado',
        muscle_group: 'Peito',
        description: null,
        is_custom: true,
      })

      renderExercises()

      await waitFor(() => {
        expect(screen.getByText('Supino Reto')).toBeInTheDocument()
      })

      // Click the edit button for this exercise
      const editBtn = screen.getByRole('button', { name: /editar supino reto/i })
      await userEvent.click(editBtn)

      // An input should appear with the current name
      const nameInput = screen.getByDisplayValue('Supino Reto')
      await userEvent.clear(nameInput)
      await userEvent.type(nameInput, 'Supino Inclinado')

      const saveBtn = screen.getByRole('button', { name: /salvar/i })
      await userEvent.click(saveBtn)

      await waitFor(() => {
        expect(client.updateExercise).toHaveBeenCalledWith(5, { name: 'Supino Inclinado' })
      })
    })
  })
})
