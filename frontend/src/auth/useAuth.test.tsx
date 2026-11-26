/**
 * Integration test: a 401 response from any API call dispatches the
 * "auth:unauthorized" CustomEvent, which AuthProvider listens to and
 * responds to by calling signOut() — flipping isAuthenticated to false.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCycle } from '../api/client'
import { clearToken, setToken } from './token'
import { AuthProvider, useAuth } from './useAuth'

// Use the real client so request() actually runs and dispatches the event
// (do NOT mock '../api/client' — we only mock global.fetch below).

function TestBed() {
  const { isAuthenticated } = useAuth()
  const handleFetch = async () => {
    try {
      await getCycle()
    } catch {
      // AuthError expected — component just reacts to auth state
    }
  }
  return (
    <div>
      <span data-testid="auth-status">
        {isAuthenticated ? 'authenticated' : 'signed-out'}
      </span>
      <button onClick={handleFetch}>trigger fetch</button>
    </div>
  )
}

describe('AuthProvider — 401 event', () => {
  beforeEach(() => {
    setToken('jwt')
  })

  afterEach(() => {
    clearToken()
    vi.restoreAllMocks()
  })

  it('signs out when request() triggers auth:unauthorized', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve(''),
    } as Response)

    const user = userEvent.setup()
    render(
      <AuthProvider>
        <TestBed />
      </AuthProvider>,
    )

    // Starts authenticated because a token was stored in beforeEach
    expect(screen.getByTestId('auth-status').textContent).toBe('authenticated')

    await user.click(screen.getByRole('button', { name: /trigger fetch/i }))

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('signed-out')
    })
  })
})
