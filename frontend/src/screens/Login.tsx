import { useState } from 'react'
import { login } from '../api/client'

interface LoginProps {
  onAuthenticated: () => void
}

export default function Login({ onAuthenticated }: LoginProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(password)
      onAuthenticated()
    } catch {
      setError('Incorrect password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        padding: '24px 16px',
        gap: '16px',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--serif)',
          fontSize: '32px',
          fontWeight: 400,
          margin: 0,
          color: 'var(--text)',
        }}
      >
        Life Track
      </h1>

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '100%',
          maxWidth: '320px',
        }}
      >
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          style={{
            height: '44px',
            padding: '0 16px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-control)',
            fontSize: 'var(--fs-body)',
            fontFamily: 'var(--font)',
            background: 'var(--raised)',
            color: 'var(--text)',
            outline: 'none',
          }}
        />

        {error && (
          <p
            role="alert"
            style={{
              margin: 0,
              color: 'var(--negative)',
              fontSize: 'var(--fs-small)',
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            height: '44px',
            minHeight: '44px',
            padding: '0 24px',
            background: 'var(--accent)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--radius-control)',
            fontSize: 'var(--fs-body)',
            fontFamily: 'var(--font)',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
