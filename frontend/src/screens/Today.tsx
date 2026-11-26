import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCycle, getLastSet, getTemplate, listBodyweight } from '../api/client'
import type {
  BodyWeightOut,
  CycleGetResponse,
  LastSet,
  StepResponse,
  TemplateResponse,
} from '../api/types'
import { CycleCards } from '../components/CycleCards'
import { Greeting } from '../components/Greeting'
import { PlanPanel } from '../components/PlanPanel'
import { nextStep, stepLabel } from '../lib/cycle'

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

type ScreenState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error' }
  | {
      status: 'non-template'
      cycle: CycleGetResponse
      currentStep: StepResponse
      nextStp: StepResponse | null
      /** Names for next-step template (and beyond) so cycle cards show real names. */
      templateNames: Map<number, string>
      bw: BodyWeightOut[]
    }
  | {
      status: 'ready'
      cycle: CycleGetResponse
      currentStep: StepResponse
      nextStp: StepResponse | null
      currentTemplate: TemplateResponse
      templateNames: Map<number, string>
      /**
       * null = never logged (primera vez); built from getLastSet resolving to null.
       * Explicit null | null in the value prevents a future `!== undefined` guard
       * from silently dropping the "primeira vez" case.
       */
      lastSets: Map<number, LastSet | null>
      bw: BodyWeightOut[]
    }

// ---------------------------------------------------------------------------
// Body-weight tile (inline; no chart in Phase 1)
// ---------------------------------------------------------------------------

function BodyWeightTile({ bw }: { bw: BodyWeightOut[] }) {
  if (bw.length === 0) {
    return (
      <section className="panel" aria-label="Peso corporal">
        <header>
          <h2>Peso corporal</h2>
        </header>
        <p style={{ color: 'var(--muted)', fontSize: 'var(--fs-body)', margin: 0 }}>
          Nenhum registro ainda.
        </p>
      </section>
    )
  }

  const latest = bw[bw.length - 1]
  const diff = bw.length > 1 ? latest.weight - bw[0].weight : null

  return (
    <section className="panel" aria-label="Peso corporal">
      <header>
        <h2>Peso corporal</h2>
        <span className="meta">últimas {bw.length} pesagens</span>
      </header>
      <div className="bw-head">
        <span className="bw-val">
          {latest.weight.toLocaleString('pt-BR', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
          <small>kg</small>
        </span>
        {diff !== null && (
          <span
            className="bw-trend"
            style={{ color: diff <= 0 ? 'var(--positive)' : 'var(--negative)' }}
          >
            {diff <= 0 ? '−' : '+'}
            {Math.abs(diff).toFixed(1)} kg
          </span>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Run/rest marker panel
// ---------------------------------------------------------------------------

function RunRestMarker({ step }: { step: StepResponse }) {
  const label = stepLabel(step)
  return (
    <section className="panel">
      <header>
        <h2>{label}</h2>
      </header>
      <p style={{ color: 'var(--muted)', fontSize: 'var(--fs-body)', margin: 0 }}>
        Atividade registrada no Strava — sem treino de força hoje.
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Ask-the-AI placeholder (Phase 2 — disabled)
// ---------------------------------------------------------------------------

function AskAIRow() {
  return (
    <button
      type="button"
      disabled
      aria-label="Perguntar à IA sobre seus treinos (em breve)"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        height: '52px',
        padding: '0 16px',
        borderRadius: '999px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        color: 'var(--faint)',
        cursor: 'not-allowed',
        opacity: 0.6,
        width: '100%',
        fontFamily: 'var(--font)',
        fontSize: 'var(--fs-body)',
      }}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{ width: 18, height: 18, flexShrink: 0, stroke: 'var(--accent)', strokeWidth: 1.8, fill: 'none' }}
      >
        <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 9 9 0 0 1-3.9-.9L3 20.5l1.6-4.3a8.3 8.3 0 0 1-1.1-4.2A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" />
      </svg>
      <span>Pergunte sobre seus treinos… (em breve)</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

async function fetchNextTemplate(
  nextStp: StepResponse | null,
  currentTemplateId: number,
): Promise<TemplateResponse | null> {
  if (
    nextStp?.kind === 'template' &&
    nextStp.template_id != null &&
    nextStp.template_id !== currentTemplateId
  ) {
    return getTemplate(nextStp.template_id)
  }
  return null
}

// ---------------------------------------------------------------------------
// Today screen
// ---------------------------------------------------------------------------

export default function Today() {
  const [state, setState] = useState<ScreenState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const cycle = await getCycle()

        if (cycle.steps.length === 0) {
          if (!cancelled) setState({ status: 'empty' })
          return
        }

        const currentStep = cycle.steps[cycle.pointer]
        const nextStp = nextStep(cycle)

        if (currentStep.kind !== 'template') {
          // Run/rest step — do NOT call getTemplate for the current step.
          // But DO fetch the next step's template name so cycle cards show
          // the real workout name on the Amanhã card (not the generic "Treino").
          const nextTemplatePromise: Promise<TemplateResponse | null> =
            nextStp?.kind === 'template' && nextStp.template_id != null
              ? getTemplate(nextStp.template_id)
              : Promise.resolve(null)

          const [bw, nextTemplate] = await Promise.all([listBodyweight(), nextTemplatePromise])

          const templateNames = new Map<number, string>()
          if (nextTemplate) templateNames.set(nextTemplate.id, nextTemplate.name)

          if (!cancelled)
            setState({ status: 'non-template', cycle, currentStep, nextStp, templateNames, bw })
          return
        }

        // Template step: fetch current template + BW in parallel
        const [currentTemplate, bw] = await Promise.all([
          getTemplate(currentStep.template_id!),
          listBodyweight(),
        ])

        const templateNames = new Map<number, string>([[currentTemplate.id, currentTemplate.name]])

        // Fetch next template name + last sets in parallel
        const [nextTemplate, lastSetPairs] = await Promise.all([
          fetchNextTemplate(nextStp, currentStep.template_id!),
          Promise.all(
            currentTemplate.exercises.map((ex) =>
              getLastSet(ex.id, 1).then((ls) => [ex.id, ls] as const),
            ),
          ),
        ])

        if (nextTemplate) templateNames.set(nextTemplate.id, nextTemplate.name)

        const lastSets = new Map<number, LastSet | null>(lastSetPairs)

        if (!cancelled) {
          setState({
            status: 'ready',
            cycle,
            currentStep,
            nextStp,
            currentTemplate,
            templateNames,
            lastSets,
            bw,
          })
        }
      } catch {
        // AuthError triggers auth:unauthorized → AuthProvider → redirect to /login.
        // Other errors: show error state rather than crash.
        if (!cancelled) setState({ status: 'error' })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  // --- Render ---

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

  if (state.status === 'empty') {
    return (
      <main className="content">
        <section className="greeting">
          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontWeight: 400,
              fontSize: '28px',
              lineHeight: 1.08,
              margin: 0,
              color: 'var(--text)',
            }}
          >
            Bem-vindo, Pedro.
          </h1>
          <p
            className="line"
            style={{ marginTop: '8px', color: 'var(--muted)', fontSize: 'var(--fs-body)' }}
          >
            Vamos começar.
          </p>
        </section>
        <section
          className="panel"
          style={{ textAlign: 'center', paddingTop: '28px', paddingBottom: '28px' }}
        >
          <p style={{ color: 'var(--muted)', marginBottom: '16px', fontSize: 'var(--fs-body)' }}>
            Você ainda não tem um ciclo configurado.
          </p>
          <Link to="/cycle" className="cta">
            monte seu ciclo
          </Link>
        </section>
      </main>
    )
  }

  const now = new Date()
  const hour = now.getHours()
  const isNight = hour >= 18
  const dateStr = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  // --- Non-template (run/rest) ---

  if (state.status === 'non-template') {
    const templateNameForGreeting = stepLabel(state.currentStep)
    const nextTemplateName = state.nextStp
      ? (state.nextStp.template_id != null
          ? (state.templateNames.get(state.nextStp.template_id) ?? stepLabel(state.nextStp))
          : stepLabel(state.nextStp))
      : null

    return (
      <main className="content has-dock">
        <Greeting
          isNight={isNight}
          dateStr={dateStr}
          templateName={templateNameForGreeting}
          nextTemplateName={nextTemplateName}
        />
        <CycleCards cycle={state.cycle} templateNames={state.templateNames} />
        <RunRestMarker step={state.currentStep} />
        <BodyWeightTile bw={state.bw} />
        <AskAIRow />
      </main>
    )
  }

  // --- Ready (template step) ---

  const nextTemplateName = state.nextStp
    ? (state.nextStp.template_id != null
        ? (state.templateNames.get(state.nextStp.template_id) ?? stepLabel(state.nextStp))
        : stepLabel(state.nextStp))
    : null

  return (
    <main className="content has-dock">
      <Greeting
        isNight={isNight}
        dateStr={dateStr}
        templateName={state.currentTemplate.name}
        nextTemplateName={nextTemplateName}
      />
      <CycleCards cycle={state.cycle} templateNames={state.templateNames} />
      <PlanPanel template={state.currentTemplate} lastSets={state.lastSets} stepPosition={state.currentStep.position} />
      <BodyWeightTile bw={state.bw} />
      <AskAIRow />
    </main>
  )
}
