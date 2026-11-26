import { useCallback, useEffect, useReducer, useRef } from 'react'
import { getLastSet, getTemplate } from '../api/client'
import type { LastSet, TemplateResponse } from '../api/types'
import { loadDraft, startWorkout, upsertSet } from './localStore'
import type { WorkoutDraft, WorkoutDraftSet } from './localStore'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface WorkoutHookState {
  status: 'loading' | 'ready' | 'finishing' | 'error'
  draft: WorkoutDraft | null
  template: TemplateResponse | null
  /**
   * Map from exerciseId → last-set reference.
   * null = primeira vez (never logged); undefined = not yet fetched.
   */
  lastSets: Map<number, LastSet | null>
  /** Seconds remaining for the rest timer, or null if no rest is active. */
  restSeconds: number | null
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const REST_DURATION_SECONDS = 90

export function useWorkout(templateId: number | null) {
  const draftRef = useRef<WorkoutDraft | null>(null)
  const [tick, forceUpdate] = useReducer((x: number) => x + 1, 0)

  // We store derived state in a ref and re-render via tick to avoid stale closures
  const stateRef = useRef<WorkoutHookState>({
    status: 'loading',
    draft: null,
    template: null,
    lastSets: new Map(),
    restSeconds: null,
  })

  // ---------------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        // 1. Load or create draft
        let draft = await loadDraft()
        if (!draft) {
          draft = await startWorkout(templateId)
        }
        draftRef.current = draft

        // 2. Load template (if templateId provided and not already in draft)
        const tplId = templateId ?? draft.template_id
        if (tplId == null) {
          if (!cancelled) {
            stateRef.current = {
              ...stateRef.current,
              status: 'error',
              draft,
            }
            forceUpdate()
          }
          return
        }

        const template = await getTemplate(tplId)

        // 3. Initialize one default set per exercise if none exist in draft
        for (const ex of template.exercises) {
          const hasSet = draft.sets.some((s) => s.exercise_id === ex.id)
          if (!hasSet) {
            const defaultSet: WorkoutDraftSet = {
              id: crypto.randomUUID(),
              exercise_id: ex.id,
              position: 1,
              weight: 0,
              reps: 0,
              note: null,
              completed: false,
            }
            await upsertSet(draft, defaultSet) // mutates draft.sets + persists
          }
        }

        // 4. Fetch last-set references (excludes the active session so "hoje" doesn't echo)
        const lastSetPairs = await Promise.all(
          template.exercises.map((ex) =>
            getLastSet(ex.id, 1, draft!.id).then(
              (ls) => [ex.id, ls] as [number, LastSet | null],
              () => [ex.id, null] as [number, LastSet | null], // graceful on 404/error
            ),
          ),
        )
        const lastSets = new Map<number, LastSet | null>(lastSetPairs)

        if (!cancelled) {
          stateRef.current = {
            status: 'ready',
            draft,
            template,
            lastSets,
            restSeconds: null,
          }
          forceUpdate()
        }
      } catch {
        if (!cancelled) {
          stateRef.current = { ...stateRef.current, status: 'error' }
          forceUpdate()
        }
      }
    }

    init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function updateSet(updatedSet: WorkoutDraftSet) {
    if (!draftRef.current) return
    await upsertSet(draftRef.current, updatedSet)
    stateRef.current = { ...stateRef.current, draft: draftRef.current }
    forceUpdate()
  }

  async function addSet(exerciseId: number) {
    if (!draftRef.current) return
    const draft = draftRef.current
    const existingSets = draft.sets.filter((s) => s.exercise_id === exerciseId)
    const nextPosition = existingSets.length + 1
    const newSet: WorkoutDraftSet = {
      id: crypto.randomUUID(),
      exercise_id: exerciseId,
      position: nextPosition,
      weight: 0,
      reps: 0,
      note: null,
      completed: false,
    }
    await upsertSet(draft, newSet)
    stateRef.current = { ...stateRef.current, draft }
    forceUpdate()
  }

  async function completeSet(setId: string) {
    if (!draftRef.current) return
    const draft = draftRef.current
    const set = draft.sets.find((s) => s.id === setId)
    if (!set) return
    const updated = { ...set, completed: !set.completed }
    await upsertSet(draft, updated)
    stateRef.current = {
      ...stateRef.current,
      draft,
      restSeconds: updated.completed ? REST_DURATION_SECONDS : stateRef.current.restSeconds,
    }
    forceUpdate()
  }

  // useCallback so the function reference is stable across renders — a stable
  // skipRest means RestTimer's onSkip prop doesn't change identity on every
  // forceUpdate(), preventing redundant effect teardowns. (The ref inside
  // RestTimer also guards against this, but stable identity is a belt-and-braces fix.)
  const skipRest = useCallback(() => {
    stateRef.current = { ...stateRef.current, restSeconds: null }
    forceUpdate()
  }, []) // stateRef and forceUpdate are both stable across renders

  /**
   * Atomically flip status to 'finishing'.
   * Returns true if the transition happened, false if already finishing
   * (double-tap guard — caller should return early on false).
   */
  function markFinishing(): boolean {
    if (stateRef.current.status === 'finishing') return false
    stateRef.current = { ...stateRef.current, status: 'finishing' }
    forceUpdate()
    return true
  }

  /** Re-enable the finish button after a failed finish attempt. */
  function markFinishError() {
    stateRef.current = { ...stateRef.current, status: 'ready' }
    forceUpdate()
  }

  // tick is used in the dependency array just to satisfy linting but the actual
  // state is in stateRef so the return value is always current.
  void tick

  return {
    state: stateRef.current,
    updateSet,
    addSet,
    completeSet,
    skipRest,
    markFinishing,
    markFinishError,
  }
}
