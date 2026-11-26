import { useEffect, useRef, useState } from 'react'
import { getCycle, listTemplates, putCycle } from '../../api/client'
import type { CycleGetResponse, TemplateResponse } from '../../api/types'

// ---------------------------------------------------------------------------
// Step shape used internally (before serialising for putCycle)
// ---------------------------------------------------------------------------

type StepKind = 'template' | 'run' | 'rest'

interface DraftStep {
  /** Local ID for React keying only — never sent to backend */
  _key: number
  kind: StepKind
  /** Only valid when kind === 'template'; undefined otherwise */
  template_id?: number
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type ScreenState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; cycle: CycleGetResponse; templates: TemplateResponse[] }

// ---------------------------------------------------------------------------
// Add-template picker (inline panel shown when user clicks "Adicionar template")
// ---------------------------------------------------------------------------

function TemplatePicker({
  templates,
  onConfirm,
  onCancel,
}: {
  templates: TemplateResponse[]
  onConfirm: (templateId: number) => void
  onCancel: () => void
}) {
  const [selectedId, setSelectedId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    if (!selectedId) {
      setError('Escolha um template antes de confirmar.')
      return
    }
    setError(null)
    onConfirm(Number(selectedId))
  }

  return (
    <div
      style={{
        padding: 12,
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <label style={labelStyle}>
        <span>Template</span>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={selectStyle}
          aria-label="Escolher template"
        >
          <option value="">— selecionar —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <span role="alert" style={{ color: 'var(--negative)', fontSize: 'var(--fs-small)' }}>
          {error}
        </span>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleConfirm}
          style={btnAccentSmallStyle}
          aria-label="Confirmar template"
        >
          Confirmar template
        </button>
        <button type="button" onClick={onCancel} style={btnGhostSmallStyle}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step list item
// ---------------------------------------------------------------------------

function StepItem({
  step,
  templateName,
  onRemove,
}: {
  step: DraftStep
  templateName?: string
  onRemove: () => void
}) {
  const label =
    step.kind === 'template'
      ? (templateName ?? `Template ${step.template_id}`)
      : step.kind === 'run'
        ? 'Corrida'
        : 'Descanso'

  return (
    <li
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: '1px solid var(--rule)',
      }}
    >
      <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text)' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 999,
            background:
              step.kind === 'template'
                ? 'var(--pill-neutral-bg)'
                : step.kind === 'run'
                  ? 'var(--pill-positive-bg)'
                  : 'var(--pill-negative-bg)',
            color:
              step.kind === 'template'
                ? 'var(--pill-neutral-ink)'
                : step.kind === 'run'
                  ? 'var(--pill-positive-ink)'
                  : 'var(--pill-negative-ink)',
            fontSize: 'var(--fs-small)',
            fontWeight: 600,
            marginRight: 8,
          }}
        >
          {step.kind}
        </span>
        {label}
      </span>
      <button
        type="button"
        onClick={onRemove}
        style={btnRemoveStyle}
        aria-label={`Remover passo ${label}`}
      >
        ×
      </button>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Cycle editor main screen
// ---------------------------------------------------------------------------

export default function CycleEditor() {
  const keyRef = useRef(0)
  function nextKey(): number {
    keyRef.current += 1
    return keyRef.current
  }

  const [state, setState] = useState<ScreenState>({ status: 'loading' })
  const [steps, setSteps] = useState<DraftStep[]>([])
  const [addingTemplate, setAddingTemplate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getCycle(), listTemplates()])
      .then(([cycle, templates]) => {
        if (cancelled) return
        setState({ status: 'ready', cycle, templates })
        // Populate draft steps from the existing cycle
        const draft: DraftStep[] = cycle.steps.map((s) => ({
          _key: nextKey(),
          kind: s.kind,
          ...(s.kind === 'template' && s.template_id != null
            ? { template_id: s.template_id }
            : {}),
        }))
        setSteps(draft)
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  function addRun() {
    setSteps((prev) => [...prev, { _key: nextKey(), kind: 'run' }])
  }

  function addRest() {
    setSteps((prev) => [...prev, { _key: nextKey(), kind: 'rest' }])
  }

  function confirmTemplate(templateId: number) {
    setSteps((prev) => [
      ...prev,
      { _key: nextKey(), kind: 'template', template_id: templateId },
    ])
    setAddingTemplate(false)
  }

  function removeStep(key: number) {
    setSteps((prev) => prev.filter((s) => s._key !== key))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      // Build the payload: template steps carry template_id; run/rest must NOT
      const payload = steps.map((s) => {
        if (s.kind === 'template') {
          return { kind: s.kind as 'template', template_id: s.template_id! }
        }
        // run or rest — template_id must be absent (backend 422s if present)
        return { kind: s.kind as 'run' | 'rest' }
      })
      await putCycle(payload)
    } catch {
      setSaveError('Erro ao salvar o ciclo. Tente novamente.')
    } finally {
      setSaving(false)
    }
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

  const { templates } = state
  const templateMap = new Map(templates.map((t) => [t.id, t.name]))

  return (
    <main className="content">
      <section>
        <h1 style={pageHeadingStyle}>Ciclo de treino</h1>
      </section>

      {/* Draft step list */}
      <section className="panel" aria-label="Passos do ciclo">
        <header>
          <h2>Passos</h2>
          <span className="meta">{steps.length} passo{steps.length !== 1 ? 's' : ''}</span>
        </header>
        {steps.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 'var(--fs-body)', margin: 0 }}>
            Nenhum passo ainda. Adicione abaixo.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {steps.map((s) => (
              <StepItem
                key={s._key}
                step={s}
                templateName={
                  s.kind === 'template' && s.template_id != null
                    ? templateMap.get(s.template_id)
                    : undefined
                }
                onRemove={() => removeStep(s._key)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Add step buttons */}
      <section className="panel" aria-label="Adicionar passo">
        <header>
          <h2>Adicionar passo</h2>
        </header>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setAddingTemplate(true)}
            style={btnChipStyle}
            aria-label="Adicionar template"
            disabled={addingTemplate}
          >
            + Treino (template)
          </button>
          <button
            type="button"
            onClick={addRun}
            style={btnChipStyle}
            aria-label="Adicionar corrida"
          >
            + Corrida
          </button>
          <button
            type="button"
            onClick={addRest}
            style={btnChipStyle}
            aria-label="Adicionar descanso"
          >
            + Descanso
          </button>
        </div>

        {/* Template picker — appears inline when "Adicionar template" is clicked */}
        {addingTemplate && (
          <div style={{ marginTop: 12 }}>
            <TemplatePicker
              templates={templates}
              onConfirm={confirmTemplate}
              onCancel={() => setAddingTemplate(false)}
            />
          </div>
        )}
      </section>

      {/* Save */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {saveError && (
          <span role="alert" style={{ color: 'var(--negative)', fontSize: 'var(--fs-small)' }}>
            {saveError}
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={btnAccentStyle}
          aria-label="Salvar ciclo"
        >
          {saving ? 'Salvando…' : 'Salvar ciclo'}
        </button>
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

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 'var(--fs-body)',
  color: 'var(--muted)',
}

const selectStyle: React.CSSProperties = {
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
  width: '100%',
}

const btnAccentSmallStyle: React.CSSProperties = {
  minHeight: 44,
  padding: '0 16px',
  borderRadius: 'var(--radius-control)',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  fontFamily: 'var(--font)',
  fontSize: 'var(--fs-body)',
  fontWeight: 600,
  cursor: 'pointer',
}

const btnGhostSmallStyle: React.CSSProperties = {
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 'var(--radius-control)',
  background: 'transparent',
  color: 'var(--muted)',
  border: '1px solid var(--control)',
  fontFamily: 'var(--font)',
  fontSize: 'var(--fs-body)',
  cursor: 'pointer',
}

const btnChipStyle: React.CSSProperties = {
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 'var(--radius-control)',
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  fontFamily: 'var(--font)',
  fontSize: 'var(--fs-body)',
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
  fontSize: 18,
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
