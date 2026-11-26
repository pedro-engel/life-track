/**
 * Manifest — TDD Step 1: failing tests for the PWA manifest.
 *
 * We test the manifest.webmanifest file by importing it via Vite's ?raw import
 * (which Vitest also supports), avoiding the need for Node.js fs/path modules.
 *
 * Requirements from the brief:
 *  - display: "standalone"
 *  - name and short_name present
 *  - theme_color present
 *  - icons array includes entries for 192 and 512
 */
import manifestRaw from '../../public/manifest.webmanifest?raw'
import { describe, expect, it } from 'vitest'

function loadManifest() {
  return JSON.parse(manifestRaw) as Record<string, unknown>
}

describe('manifest.webmanifest', () => {
  it('is valid JSON and can be parsed', () => {
    expect(() => loadManifest()).not.toThrow()
  })

  it('has display set to standalone', () => {
    const manifest = loadManifest()
    expect(manifest.display).toBe('standalone')
  })

  it('has a non-empty name', () => {
    const manifest = loadManifest()
    expect(typeof manifest.name).toBe('string')
    expect((manifest.name as string).length).toBeGreaterThan(0)
  })

  it('has a non-empty short_name', () => {
    const manifest = loadManifest()
    expect(typeof manifest.short_name).toBe('string')
    expect((manifest.short_name as string).length).toBeGreaterThan(0)
  })

  it('has theme_color matching the teal brand color', () => {
    const manifest = loadManifest()
    expect(manifest.theme_color).toBe('#1b6e66')
  })

  it('has an icons array', () => {
    const manifest = loadManifest()
    expect(Array.isArray(manifest.icons)).toBe(true)
  })

  it('has a 192x192 icon entry', () => {
    const manifest = loadManifest()
    const icons = manifest.icons as Array<{ src: string; sizes: string; type?: string }>
    const icon192 = icons.find((i) => i.sizes === '192x192')
    expect(icon192).toBeDefined()
    expect(icon192!.src).toMatch(/192/)
  })

  it('has a 512x512 icon entry', () => {
    const manifest = loadManifest()
    const icons = manifest.icons as Array<{ src: string; sizes: string; type?: string }>
    const icon512 = icons.find((i) => i.sizes === '512x512')
    expect(icon512).toBeDefined()
    expect(icon512!.src).toMatch(/512/)
  })

  it('has start_url set', () => {
    const manifest = loadManifest()
    expect(typeof manifest.start_url).toBe('string')
  })
})
