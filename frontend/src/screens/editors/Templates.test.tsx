import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/client', () => ({
  listTemplates: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  listExercises: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message = 'Unauthorized') {
      super(message)
      this.name = 'AuthError'
    }
  },
}))

import * as client from '../../api/client'
import Templates from './Templates'

function renderTemplates() {
  return render(
    <MemoryRouter>
      <Templates />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

const EXERCISES = [
  { id: 1, name: 'Supino', muscle_group: 'Peito', description: null, is_custom: false },
  { id: 2, name: 'Crucifixo', muscle_group: 'Peito', description: null, is_custom: false },
  { id: 3, name: 'Remada', muscle_group: 'Costas', description: null, is_custom: false },
]

describe('Templates editor', () => {
  describe('create template with ordered exercise list', () => {
    it('preserves exercise_ids order in the createTemplate call', async () => {
      vi.mocked(client.listTemplates).mockResolvedValue([])
      vi.mocked(client.listExercises).mockResolvedValue(EXERCISES)
      vi.mocked(client.createTemplate).mockResolvedValueOnce({
        id: 1,
        name: 'Peito A',
        exercises: [EXERCISES[1], EXERCISES[0]],
      })

      renderTemplates()

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /nome do template/i })).toBeInTheDocument()
      })

      const nameInput = screen.getByRole('textbox', { name: /nome do template/i })
      await userEvent.type(nameInput, 'Peito A')

      // Add Crucifixo first (id 2), then Supino (id 1) → order must be [2, 1]
      const crucifixoBtn = screen.getByRole('button', { name: /adicionar crucifixo/i })
      const supinoBtn = screen.getByRole('button', { name: /adicionar supino/i })

      await userEvent.click(crucifixoBtn)
      await userEvent.click(supinoBtn)

      const saveBtn = screen.getByRole('button', { name: /criar template/i })
      await userEvent.click(saveBtn)

      await waitFor(() => {
        expect(client.createTemplate).toHaveBeenCalledWith('Peito A', [2, 1])
      })
    })
  })

  describe('edit template replaces exercise list', () => {
    it('calls updateTemplate with new exercise_ids', async () => {
      vi.mocked(client.listTemplates).mockResolvedValue([
        { id: 10, name: 'Costas A', exercises: [EXERCISES[2]] },
      ])
      vi.mocked(client.listExercises).mockResolvedValue(EXERCISES)
      vi.mocked(client.updateTemplate).mockResolvedValueOnce({
        id: 10,
        name: 'Costas A',
        exercises: [EXERCISES[0], EXERCISES[2]],
      })

      renderTemplates()

      await waitFor(() => {
        expect(screen.getByText('Costas A')).toBeInTheDocument()
      })

      // Click edit on this template
      const editBtn = screen.getByRole('button', { name: /editar costas a/i })
      await userEvent.click(editBtn)

      // Add Supino to the list
      const supinoBtn = screen.getByRole('button', { name: /adicionar supino/i })
      await userEvent.click(supinoBtn)

      const saveBtn = screen.getByRole('button', { name: /salvar template/i })
      await userEvent.click(saveBtn)

      await waitFor(() => {
        // The original list has [3], we added Supino [1] → new list should include Supino
        expect(client.updateTemplate).toHaveBeenCalledWith(
          10,
          expect.objectContaining({ exercise_ids: expect.arrayContaining([1]) }),
        )
      })
    })
  })

  describe('delete template', () => {
    it('calls deleteTemplate with the correct id', async () => {
      vi.mocked(client.listTemplates).mockResolvedValue([
        { id: 7, name: 'Ombros', exercises: [] },
      ])
      vi.mocked(client.listExercises).mockResolvedValue([])
      vi.mocked(client.deleteTemplate).mockResolvedValueOnce(undefined)

      renderTemplates()

      await waitFor(() => {
        expect(screen.getByText('Ombros')).toBeInTheDocument()
      })

      const deleteBtn = screen.getByRole('button', { name: /excluir ombros/i })
      await userEvent.click(deleteBtn)

      await waitFor(() => {
        expect(client.deleteTemplate).toHaveBeenCalledWith(7)
      })
    })
  })
})
