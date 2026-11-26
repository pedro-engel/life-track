/**
 * Global type declarations for the life-track frontend.
 *
 * 1. CSS module declarations — Vite handles CSS imports natively in the browser
 *    and in tests (via `css: true` in vitest config), but TypeScript's type
 *    checker still needs a declaration so `import './styles/tokens.css'`
 *    compiles without an error.
 *
 * 2. `global.fetch` — test files use `global.fetch = vi.fn(...)` to mock the
 *    Fetch API.  In a DOM lib, `fetch` lives on `globalThis` / `window`, not
 *    `global`.  We re-export `globalThis` as `global` so the assignment is
 *    type-safe in Node/jsdom test environments.
 */

// ---- CSS import declarations ----
declare module '*.css' {
  const content: Record<string, string>
  export default content
}

// ---- global.fetch in test files ----
// Node 18+ exposes fetch on globalThis; jsdom inherits it.
// Declaring `var global` as typeof globalThis makes `global.fetch = ...`
// type-safe in .ts/.tsx test files that run in a Node/jsdom environment.
declare var global: typeof globalThis
