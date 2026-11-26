import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'

// Node.js v22+ adds globalThis.localStorage as an experimental getter that
// returns undefined without --localstorage-file.  jsdom provides window.localStorage
// but cannot override a non-configurable descriptor on globalThis.  We install a
// per-suite in-memory mock so token.ts (and anything else that uses bare `localStorage`)
// works in all test environments.
;(() => {
  let available = false
  try {
    available = typeof localStorage !== 'undefined' && localStorage !== null
    if (available) localStorage.setItem('_probe', '1')
  } catch {
    available = false
  }

  if (!available) {
    let _store: Record<string, string> = {}
    const mock: Storage = {
      getItem: (key: string) => Object.prototype.hasOwnProperty.call(_store, key) ? _store[key] : null,
      setItem: (key: string, value: string) => { _store[key] = String(value) },
      removeItem: (key: string) => { delete _store[key] },
      clear: () => { _store = {} },
      get length() { return Object.keys(_store).length },
      key: (n: number) => Object.keys(_store)[n] ?? null,
    }
    try {
      Object.defineProperty(globalThis, 'localStorage', {
        value: mock,
        configurable: true,
        writable: true,
      })
    } catch {
      // If defineProperty fails, the environment may already supply a working localStorage
    }
  } else {
    // Clean up the probe key
    try { localStorage.removeItem('_probe') } catch { /* ignore */ }
  }
})()
