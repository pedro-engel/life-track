import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Login from './Login'

vi.mock('../api/client', () => ({
  login: vi.fn(),
}))

import * as client from '../api/client'

describe('Login screen', () => {
  it('wrong password shows error and does not navigate', async () => {
    vi.mocked(client.login).mockRejectedValueOnce(new Error('Incorrect password'))
    const onAuthenticated = vi.fn()
    const user = userEvent.setup()
    render(<Login onAuthenticated={onAuthenticated} />)

    await user.type(screen.getByPlaceholderText(/password/i), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(onAuthenticated).not.toHaveBeenCalled()
  })

  it('success calls onAuthenticated', async () => {
    vi.mocked(client.login).mockResolvedValueOnce(undefined)
    const onAuthenticated = vi.fn()
    const user = userEvent.setup()
    render(<Login onAuthenticated={onAuthenticated} />)

    await user.type(screen.getByPlaceholderText(/password/i), 'correctpassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalled()
    })
  })
})
