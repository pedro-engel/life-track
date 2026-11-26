import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/client', () => ({
  getCycle: vi.fn(),
  putCycle: vi.fn(),
  listTemplates: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message = 'Unauthorized') {
      super(message)
      this.name = 'AuthError'
    }
  },
}))

import * as client from '../../api/client'
import CycleEditor from './CycleEditor'

function renderCycleEditor() {
  return render(
    <MemoryRouter>
      <CycleEditor />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

const TEMPLATES = [
  { id: 1, name: 'Peito', exercises: [] },
  { id: 2, name: 'Costas', exercises: [] },
]

describe('CycleEditor', () => {
  describe('builds valid steps', () => {
    it('sends putCycle with template_id only on template steps, absent on run/rest', async () => {
      vi.mocked(client.getCycle).mockResolvedValueOnce({
        steps: [],
        pointer: 0,
        next: null,
      })
      vi.mocked(client.listTemplates).mockResolvedValueOnce(TEMPLATES)
      vi.mocked(client.putCycle).mockResolvedValueOnce({
        steps: [
          { position: 0, kind: 'template', template_id: 1 },
          { position: 1, kind: 'run', template_id: null },
          { position: 2, kind: 'rest', template_id: null },
        ],
        pointer: 0,
        next: null,
      })

      renderCycleEditor()

      await waitFor(() => {
        // The editor should show step-adding controls
        expect(screen.getByRole('button', { name: /adicionar template/i })).toBeInTheDocument()
      })

      // Add a template step and select "Peito"
      await userEvent.click(screen.getByRole('button', { name: /adicionar template/i }))
      // A template selector should appear — select Peito
      const templateSelect = screen.getByRole('combobox', { name: /escolher template/i })
      await userEvent.selectOptions(templateSelect, '1')
      await userEvent.click(screen.getByRole('button', { name: /confirmar template/i }))

      // Add a run step
      await userEvent.click(screen.getByRole('button', { name: /adicionar corrida/i }))

      // Add a rest step
      await userEvent.click(screen.getByRole('button', { name: /adicionar descanso/i }))

      // Save the cycle
      const saveBtn = screen.getByRole('button', { name: /salvar ciclo/i })
      await userEvent.click(saveBtn)

      await waitFor(() => {
        expect(client.putCycle).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ kind: 'template', template_id: 1 }),
          ]),
        )
      })

      const callArg = vi.mocked(client.putCycle).mock.calls[0][0]

      // template step must have template_id
      const templateStep = callArg.find((s) => s.kind === 'template')
      expect(templateStep).toBeDefined()
      expect(templateStep!.template_id).toBe(1)

      // run step must NOT have template_id (or it must be absent/undefined)
      const runStep = callArg.find((s) => s.kind === 'run')
      expect(runStep).toBeDefined()
      expect(runStep!.template_id).toBeUndefined()

      // rest step must NOT have template_id
      const restStep = callArg.find((s) => s.kind === 'rest')
      expect(restStep).toBeDefined()
      expect(restStep!.template_id).toBeUndefined()
    })
  })

  describe('template step needs template_id', () => {
    it('prevents saving a template step that has no template selected', async () => {
      vi.mocked(client.getCycle).mockResolvedValueOnce({
        steps: [],
        pointer: 0,
        next: null,
      })
      vi.mocked(client.listTemplates).mockResolvedValueOnce(TEMPLATES)

      renderCycleEditor()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /adicionar template/i })).toBeInTheDocument()
      })

      // Click to add a template step but do NOT select a template
      await userEvent.click(screen.getByRole('button', { name: /adicionar template/i }))

      // Try to confirm without selecting
      const confirmBtn = screen.getByRole('button', { name: /confirmar template/i })
      await userEvent.click(confirmBtn)

      // The step must NOT have been added — step counter still shows 0
      expect(screen.getByText('0 passos')).toBeInTheDocument()
      // putCycle must not have been called
      expect(client.putCycle).not.toHaveBeenCalled()

      // An error/warning should inform the user
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})
