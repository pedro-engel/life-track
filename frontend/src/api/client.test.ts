import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthError, getCycle, login } from './client'
import { clearToken, getToken, setToken } from '../auth/token'

describe('API client', () => {
  beforeEach(() => {
    clearToken()
  })

  afterEach(() => {
    clearToken()
    vi.restoreAllMocks()
  })

  it('login stores token', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ token: 'jwt' }),
    } as Response)

    await login('pw')
    expect(getToken()).toBe('jwt')
  })

  it('attaches bearer', async () => {
    setToken('jwt')
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ steps: [], pointer: 0, next: null })),
    } as Response)

    await getCycle()

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt')
  })

  it('401 clears token and throws AuthError', async () => {
    setToken('jwt')
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve(''),
    } as Response)

    await expect(getCycle()).rejects.toBeInstanceOf(AuthError)
    expect(getToken()).toBeNull()
  })
})
