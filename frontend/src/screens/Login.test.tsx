import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/useAuth'
import Login from './Login'

vi.mock('../api/client', () => ({
  login: vi.fn(),
  // Keep AuthError real so Login.tsx can use instanceof correctly
  AuthError: class AuthError extends Error {
    constructor(message = 'Unauthorized') {
      super(message)
      this.name = 'AuthError'
    }
  },
}))

import * as client from '../api/client'

afterEach(() => {
  vi.clearAllMocks()
})

function renderLogin(onAuthenticated = vi.fn()) {
  return render(
    <AuthProvider>
      <Login onAuthenticated={onAuthenticated} />
    </AuthProvider>,
  )
}

describe('Login screen', () => {
  it('wrong password shows error and does not navigate', async () => {
    // Minor 4: use real AuthError type so instanceof check in Login.tsx exercises properly
    vi.mocked(client.login).mockRejectedValueOnce(new client.AuthError('Incorrect password'))
    const onAuthenticated = vi.fn()
    const user = userEvent.setup()
    renderLogin(onAuthenticated)

    await user.type(screen.getByPlaceholderText(/password/i), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(screen.getByRole('alert').textContent).toMatch(/incorrect password/i)
    expect(onAuthenticated).not.toHaveBeenCalled()
  })

  it('success calls onAuthenticated', async () => {
    // login() now returns Promise<string> — the JWT token
    vi.mocked(client.login).mockResolvedValueOnce('the-jwt-token')
    const onAuthenticated = vi.fn()
    const user = userEvent.setup()
    renderLogin(onAuthenticated)

    await user.type(screen.getByPlaceholderText(/password/i), 'correctpassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalled()
    })
  })
})
