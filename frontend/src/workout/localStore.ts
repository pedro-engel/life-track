/** Shapes stored in IndexedDB for offline-resilient workout tracking. */

export interface WorkoutDraftSet {
  id: string
  exercise_id: number
  position: number
  weight: number
  reps: number
  note: string | null
  completed: boolean
}

export interface WorkoutDraft {
  id: string
  started_at: string
  template_id: number | null
  finished_at?: string | null
  sets: WorkoutDraftSet[]
}

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

const DB_NAME = 'life-track'
const DB_VERSION = 1
const STORE = 'workout-draft'
const KEY = 'current'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
    req.onerror = () => reject(req.error)
  })
}

function idbGet(db: IDBDatabase): Promise<WorkoutDraft | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(KEY)
    req.onsuccess = () => resolve(req.result as WorkoutDraft | undefined)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db: IDBDatabase, value: WorkoutDraft): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(new Error('Transaction aborted'))
  })
}

function idbDelete(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(new Error('Transaction aborted'))
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new workout draft with a stable client UUID and persist it to IDB.
 * Returns the draft so callers can pass it to upsertSet / flush.
 */
export async function startWorkout(templateId: number | null): Promise<WorkoutDraft> {
  const draft: WorkoutDraft = {
    id: crypto.randomUUID(),
    started_at: new Date().toISOString(),
    template_id: templateId,
    sets: [],
  }
  const db = await openDB()
  await idbPut(db, draft)
  db.close()
  return draft
}

/**
 * Add or replace a set in the draft (by id), then persist the whole draft.
 * Mutates `draft.sets` in place so the caller's reference stays current.
 */
export async function upsertSet(draft: WorkoutDraft, set: WorkoutDraftSet): Promise<void> {
  const idx = draft.sets.findIndex((s) => s.id === set.id)
  if (idx >= 0) {
    draft.sets[idx] = set
  } else {
    draft.sets.push(set)
  }
  const db = await openDB()
  await idbPut(db, draft)
  db.close()
}

/**
 * Load the current workout draft from IDB.
 * Returns null if none exists (first run or after clearDraft).
 */
export async function loadDraft(): Promise<WorkoutDraft | null> {
  const db = await openDB()
  const result = await idbGet(db)
  db.close()
  return result ?? null
}

/**
 * Delete the current draft from IDB (called after a successful finish).
 */
export async function clearDraft(): Promise<void> {
  const db = await openDB()
  await idbDelete(db)
  db.close()
}
