import { useEffect, useState } from 'react'
import {
  createTemplate,
  deleteTemplate,
  listExercises,
  listTemplates,
  updateTemplate,
} from '../../api/client'
import type { Exercise, TemplateResponse } from '../../api/types'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type ScreenState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; templates: TemplateResponse[]; exercises: Exercise[] }

type FormMode = { kind: 'create' } | { kind: 'edit'; template: TemplateResponse }

// ---------------------------------------------------------------------------
// Template form (create + edit)
// ---------------------------------------------------------------------------

function TemplateForm({
  mode,
  exercises,
  onDone,
  onCancel,
}: {
  mode: FormMode
  exercises: Exercise[]
  onDone: () => void
  onCancel: () => void
}) {
  const isEdit = mode.kind === 'edit'
  const initName = isEdit ? mode.template.name : ''
  const initIds = isEdit ? mode.template.exercises.map((e) => e.id) : []

  const [name, setName] = useState(initName)
  const [selectedIds, setSelectedIds] = useState<number[]>(initIds)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Exercises not yet in the selection
  const available = exercises.filter((e) => !selectedIds.includes(e.id))

  function addExercise(id: number) {
    setSelectedIds((prev) => [...prev, id])
  }

  function removeExercise(id: number) {
    setSelectedIds((prev) => prev.filter((x) => x !== id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        await updateTemplate(mode.template.id, { name: name.trim(), exercise_ids: selectedIds })
      } else {
        await createTemplate(name.trim(), selectedIds)
      }
      onDone()
    } catch {
      setError('Erro ao salvar. Tente novamente.')
      setSaving(false)
    }
  }

  const selectedExercises = selectedIds
    .map((id) => exercises.find((e) => e.id === id))
    .filter(Boolean) as Exercise[]

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={labelStyle}>
        <span>Nome do template</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Peito A"
          style={inputStyle}
          aria-label="Nome do template"
        />
      </label>

      {/* Available exercises */}
      {available.length > 0 && (
        <div>
          <p style={sectionLabelStyle}>Exercícios disponíveis</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {available.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => addExercise(ex.id)}
                style={btnChipStyle}
                aria-label={`Adicionar ${ex.name}`}
              >
                + {ex.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected exercises (ordered) */}
      {selectedExercises.length > 0 && (
        <div>
          <p style={sectionLabelStyle}>Exercícios selecionados</p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {selectedExercises.map((ex, idx) => (
              <li
                key={ex.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 8px',
                  background: 'var(--surface)',
                  borderRadius: 8,
                }}
              >
                <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text)' }}>
                  {idx + 1}. {ex.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeExercise(ex.id)}
                  style={btnRemoveStyle}
                  aria-label={`Remover ${ex.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <span role="alert" style={{ color: 'var(--negative)', fontSize: 'var(--fs-small)' }}>
          {error}
        </span>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          style={btnAccentStyle}
          aria-label={isEdit ? 'Salvar template' : 'Criar template'}
        >
          {isEdit ? 'Salvar template' : 'Criar template'}
        </button>
        {isEdit && (
          <button type="button" onClick={onCancel} style={btnGhostStyle}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Templates screen
// ---------------------------------------------------------------------------

export default function Templates() {
  const [state, setState] = useState<ScreenState>({ status: 'loading' })
  const [formMode, setFormMode] = useState<FormMode>({ kind: 'create' })
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function load() {
    try {
      const [templates, exercises] = await Promise.all([listTemplates(), listExercises()])
      setState({ status: 'ready', templates, exercises })
    } catch {
      setState({ status: 'error' })
    }
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([listTemplates(), listExercises()])
      .then(([templates, exercises]) => {
        if (!cancelled) setState({ status: 'ready', templates, exercises })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleDelete(id: number) {
    setDeleteError(null)
    try {
      await deleteTemplate(id)
    } catch {
      setDeleteError('Erro ao excluir. Tente novamente.')
      return
    }
    await load()
  }

  function handleDone() {
    setFormMode({ kind: 'create' })
    load()
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

  const { templates, exercises } = state

  return (
    <main className="content">
      <section>
        <h1 style={pageHeadingStyle}>Templates</h1>
      </section>

      {/* Template list */}
      <section className="panel" aria-label="Lista de templates">
        {deleteError && (
          <span role="alert" style={{ color: 'var(--negative)', fontSize: 'var(--fs-small)', display: 'block', marginBottom: 8 }}>
            {deleteError}
          </span>
        )}
        {templates.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 'var(--fs-body)', margin: 0 }}>
            Nenhum template ainda.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {templates.map((t) => (
              <li
                key={t.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--rule)',
                }}
              >
                <span style={{ fontSize: 'var(--fs-body)', fontWeight: 500, color: 'var(--text)' }}>
                  {t.name}
                  <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 6, fontSize: 'var(--fs-small)' }}>
                    {t.exercises.length} exerc.
                  </span>
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setFormMode({ kind: 'edit', template: t })}
                    style={btnGhostSmallStyle}
                    aria-label={`Editar ${t.name}`}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id)}
                    style={btnDangerSmallStyle}
                    aria-label={`Excluir ${t.name}`}
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Create / Edit form */}
      <section className="panel" aria-label={formMode.kind === 'edit' ? 'Editar template' : 'Novo template'}>
        <header>
          <h2>{formMode.kind === 'edit' ? `Editar ${formMode.template.name}` : 'Novo template'}</h2>
        </header>
        <TemplateForm
          key={formMode.kind === 'edit' ? formMode.template.id : 'create'}
          mode={formMode}
          exercises={exercises}
          onDone={handleDone}
          onCancel={() => setFormMode({ kind: 'create' })}
        />
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

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 'var(--fs-small)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: 'var(--muted)',
  margin: '0 0 6px',
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 'var(--fs-body)',
  color: 'var(--muted)',
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
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 'var(--radius-control)',
  background: 'transparent',
  color: 'var(--accent)',
  border: '1px solid var(--border)',
  fontFamily: 'var(--font)',
  fontSize: 'var(--fs-small)',
  cursor: 'pointer',
}

const btnDangerSmallStyle: React.CSSProperties = {
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 'var(--radius-control)',
  background: 'transparent',
  color: 'var(--negative)',
  border: '1px solid var(--border)',
  fontFamily: 'var(--font)',
  fontSize: 'var(--fs-small)',
  cursor: 'pointer',
}

const btnChipStyle: React.CSSProperties = {
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 'var(--radius-control)',
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  fontFamily: 'var(--font)',
  fontSize: 'var(--fs-small)',
  cursor: 'pointer',
}

const btnRemoveStyle: React.CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  borderRadius: '50%',
  background: 'transparent',
  color: 'var(--muted)',
  border: 'none',
  fontFamily: 'var(--font)',
  fontSize: 16,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
}
