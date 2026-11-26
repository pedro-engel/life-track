import { useState } from 'react'

interface LogBodyWeightProps {
  /** Called with the parsed weight (> 0) on submit. */
  onLog: (weight: number) => void
}

/**
 * Inline form to log a new body-weight entry.
 * Client-side guard: weight must be > 0 (backend also requires > 0).
 */
export function LogBodyWeight({ onLog }: LogBodyWeightProps) {
  const [value, setValue] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const w = parseFloat(value)
    if (!Number.isFinite(w) || w <= 0) return
    onLog(w)
    setValue('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
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
        style={{
          flex: 1,
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
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Registrar
      </button>
    </form>
  )
}
