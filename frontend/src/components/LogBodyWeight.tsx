import { useState } from 'react'

interface LogBodyWeightProps {
  /**
   * Called with the parsed weight (> 0) on submit.
   * Returns a Promise — the form awaits it and only clears the input on
   * resolution; on rejection it surfaces an inline error and preserves the
   * value so the user can correct and retry without losing their entry.
   */
  onLog: (weight: number) => Promise<void>
}

/**
 * Inline form to log a new body-weight entry.
 * Client-side guard: weight must be > 0 (backend also requires > 0).
 * Awaits the parent's async handler before clearing the field, so a failed
 * POST never silently swallows the user's weigh-in.
 */
export function LogBodyWeight({ onLog }: LogBodyWeightProps) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const w = parseFloat(value)
    if (!Number.isFinite(w) || w <= 0) return

    setSubmitting(true)
    setError(null)
    try {
      await onLog(w)
      setValue('')        // only clear the field on success
    } catch {
      setError('Erro ao registrar. Tente novamente.')
      // value is intentionally NOT cleared — user can correct and retry
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
        marginTop: 10,
      }}
    >
      <label
        htmlFor="new-bw"
        style={{
          fontSize: 'var(--fs-small)',
          color: 'var(--muted)',
          whiteSpace: 'nowrap',
        }}
      >
        Registrar peso
      </label>
      <input
        id="new-bw"
        type="number"
        step="0.1"
        min="0.1"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="kg"
        disabled={submitting}
        style={{
          flex: 1,
          minWidth: 80,
          height: 36,
          padding: '0 10px',
          border: '1px solid var(--control)',
          borderRadius: 'var(--radius-control)',
          fontFamily: 'var(--font)',
          fontSize: 'var(--fs-body)',
          background: 'var(--ground)',
          color: 'var(--text)',
        }}
      />
      <button
        type="submit"
        disabled={submitting}
        style={{
          height: 36,
          padding: '0 16px',
          borderRadius: 'var(--radius-control)',
          background: 'var(--primary)',
          color: 'var(--primary-ink)',
          border: 'none',
          fontFamily: 'var(--font)',
          fontSize: 'var(--fs-body)',
          fontWeight: 600,
          cursor: submitting ? 'wait' : 'pointer',
          whiteSpace: 'nowrap',
          opacity: submitting ? 0.6 : 1,
        }}
      >
        Registrar
      </button>

      {error && (
        <p
          role="alert"
          style={{
            width: '100%',
            margin: 0,
            fontSize: 'var(--fs-small)',
            color: 'var(--negative)',
          }}
        >
          {error}
        </p>
      )}
    </form>
  )
}
