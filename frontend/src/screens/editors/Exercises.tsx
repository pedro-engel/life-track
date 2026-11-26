import { useEffect, useState } from 'react'
import { createExercise, listExercises, updateExercise } from '../../api/client'
import type { Exercise } from '../../api/types'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type ScreenState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; exercises: Exercise[] }

// ---------------------------------------------------------------------------
// Group exercises by muscle_group
// ---------------------------------------------------------------------------

function groupByMuscle(exercises: Exercise[]): Map<string, Exercise[]> {
  const map = new Map<string, Exercise[]>()
  for (const ex of exercises) {
    const group = map.get(ex.muscle_group) ?? []
    group.push(ex)
    map.set(ex.muscle_group, group)
  }
  return map
}

// ---------------------------------------------------------------------------
// Inline edit row
// ---------------------------------------------------------------------------

function EditRow({
  exercise,
  onSave,
  onCancel,
}: {
  exercise: Exercise
  onSave: (id: number, name: string) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(exercise.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onSave(exercise.id, name.trim())
    } catch {
      setError('Erro ao salvar. Tente novamente.')
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0' }}>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={inputStyle}
        aria-label="Nome do exercício"
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        style={btnAccentStyle}
        aria-label="Salvar"
      >
        Salvar
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={btnGhostStyle}
        aria-label="Cancelar"
      >
        Cancelar
      </button>
      {error && <span role="alert" style={{ color: 'var(--negative)', fontSize: 'var(--fs-small)' }}>{error}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create form
// ---------------------------------------------------------------------------

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [group, setGroup] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !group.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createExercise({ name: name.trim(), muscle_group: group.trim() })
      setName('')
      setGroup('')
      onCreated()
    } catch {
      setError('Erro ao criar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={labelStyle}>
        <span>Nome</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Supino Reto"
          style={inputStyle}
          aria-label="Nome"
        />
      </label>
      <label style={labelStyle}>
        <span>Grupo muscular</span>
        <input
          type="text"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          placeholder="Ex: Peito"
          style={inputStyle}
          aria-label="Grupo muscular"
        />
      </label>
      {error && <span role="alert" style={{ color: 'var(--negative)', fontSize: 'var(--fs-small)' }}>{error}</span>}
      <button
        type="submit"
        disabled={saving || !name.trim() || !group.trim()}
        style={btnAccentStyle}
        aria-label="Adicionar exercício"
      >
        Adicionar
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Exercises screen
// ---------------------------------------------------------------------------

export default function Exercises() {
  const [state, setState] = useState<ScreenState>({ status: 'loading' })
  const [editingId, setEditingId] = useState<number | null>(null)

  async function load() {
    try {
      const exercises = await listExercises()
      setState({ status: 'ready', exercises })
    } catch {
      setState({ status: 'error' })
    }
  }

  useEffect(() => {
    let cancelled = false
    listExercises()
      .then((exercises) => {
        if (!cancelled) setState({ status: 'ready', exercises })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [])

  async function handleSaveName(id: number, name: string) {
    await updateExercise(id, { name })
    setEditingId(null)
    // Refresh
    const exercises = await listExercises()
    setState({ status: 'ready', exercises })
  }

  if (state.status === 'loading') {
    return (
      <main className="content">
        <p style={{ color: 'var(--muted)' }}>Carregando…</p>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="content">
        <p style={{ color: 'var(--muted)' }}>Algo deu errado. Tente novamente.</p>
      </main>
    )
  }

  const { exercises } = state
  const groups = groupByMuscle(exercises)

  return (
    <main className="content">
      <section>
        <h1 style={pageHeadingStyle}>Exercícios</h1>
      </section>

      {/* Exercise list grouped by muscle */}
      <section className="panel" aria-label="Lista de exercícios">
        {groups.size === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 'var(--fs-body)', margin: 0 }}>
            Nenhum exercício cadastrado.
          </p>
        ) : (
          Array.from(groups.entries()).map(([group, exs]) => (
            <div key={group} style={{ marginBottom: 16 }}>
              <h3 style={groupHeadingStyle}>{group}</h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {exs.map((ex) => (
                  <li key={ex.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--rule)' }}>
                    {editingId === ex.id ? (
                      <EditRow
                        exercise={ex}
                        onSave={handleSaveName}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text)' }}>
                          {ex.name}
                          {ex.is_custom && (
                            <span style={{ marginLeft: 6, fontSize: 'var(--fs-small)', color: 'var(--muted)' }}>
                              (custom)
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingId(ex.id)}
                          style={btnGhostSmallStyle}
                          aria-label={`Editar ${ex.name}`}
                        >
                          Editar
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {/* Create form */}
      <section className="panel" aria-label="Novo exercício">
        <header>
          <h2>Novo exercício</h2>
        </header>
        <CreateForm onCreated={load} />
      </section>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const pageHeadingStyle: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontWeight: 400,
  fontSize: '24px',
  margin: 0,
  color: 'var(--text)',
}

const groupHeadingStyle: React.CSSProperties = {
  fontSize: 'var(--fs-section)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--muted)',
  margin: '0 0 6px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  padding: '0 12px',
  border: '1px solid var(--control)',
  borderRadius: 'var(--radius-control)',
  fontFamily: 'var(--font)',
  fontSize: 'var(--fs-body)',
  background: 'var(--ground)',
  color: 'var(--text)',
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 'var(--fs-body)',
  color: 'var(--muted)',
}

const btnAccentStyle: React.CSSProperties = {
  height: 44,
  padding: '0 20px',
  borderRadius: 'var(--radius-control)',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  fontFamily: 'var(--font)',
  fontSize: 'var(--fs-body)',
  fontWeight: 600,
  cursor: 'pointer',
}

const btnGhostStyle: React.CSSProperties = {
  height: 44,
  padding: '0 16px',
  borderRadius: 'var(--radius-control)',
  background: 'transparent',
  color: 'var(--muted)',
  border: '1px solid var(--control)',
  fontFamily: 'var(--font)',
  fontSize: 'var(--fs-body)',
  cursor: 'pointer',
}

const btnGhostSmallStyle: React.CSSProperties = {
  height: 32,
  padding: '0 12px',
  borderRadius: 'var(--radius-control)',
  background: 'transparent',
  color: 'var(--accent)',
  border: '1px solid var(--border)',
  fontFamily: 'var(--font)',
  fontSize: 'var(--fs-small)',
  cursor: 'pointer',
}
