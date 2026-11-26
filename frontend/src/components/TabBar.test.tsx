/**
 * TabBar — TDD Step 1: failing tests for the fixed bottom navigation bar.
 *
 * Requirements:
 *  - Renders three destinations: Hoje (/), Progresso (/progress), Editar (/editors/...)
 *  - Marks the active route (aria-current="page" on the active link)
 *  - Each tap target is ≥44px (min-height or height)
 *  - Applies env(safe-area-inset-bottom) padding to the bar
 *  - position: fixed
 */
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TabBar from './TabBar'

function renderTabBar(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <TabBar />
    </MemoryRouter>,
  )
}

describe('TabBar', () => {
  describe('destinations', () => {
    it('renders Hoje link pointing to /', () => {
      renderTabBar('/')
      const link = screen.getByRole('link', { name: /hoje/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/')
    })

    it('renders Progresso link pointing to /progress', () => {
      renderTabBar('/')
      const link = screen.getByRole('link', { name: /progresso/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/progress')
    })

    it('renders Editar link pointing to /editors/exercises or /editors/...', () => {
      renderTabBar('/')
      const link = screen.getByRole('link', { name: /editar/i })
      expect(link).toBeInTheDocument()
      // any editors path
      expect(link.getAttribute('href')).toMatch(/^\/editors\//)
    })
  })

  describe('active route marking', () => {
    it('marks Hoje as active when at /', () => {
      renderTabBar('/')
      const link = screen.getByRole('link', { name: /hoje/i })
      expect(link).toHaveAttribute('aria-current', 'page')
    })

    it('does not mark Progresso as active when at /', () => {
      renderTabBar('/')
      const link = screen.getByRole('link', { name: /progresso/i })
      expect(link).not.toHaveAttribute('aria-current', 'page')
    })

    it('marks Progresso as active when at /progress', () => {
      renderTabBar('/progress')
      const link = screen.getByRole('link', { name: /progresso/i })
      expect(link).toHaveAttribute('aria-current', 'page')
    })

    it('marks Editar as active when at /editors/exercises', () => {
      renderTabBar('/editors/exercises')
      const link = screen.getByRole('link', { name: /editar/i })
      expect(link).toHaveAttribute('aria-current', 'page')
    })

    it('marks Hoje as active when at /today', () => {
      renderTabBar('/today')
      const link = screen.getByRole('link', { name: /hoje/i })
      expect(link).toHaveAttribute('aria-current', 'page')
    })
  })

  describe('layout and touch targets', () => {
    it('has position fixed on the bar element', () => {
      const { container } = renderTabBar('/')
      const nav = container.querySelector('nav')
      expect(nav).not.toBeNull()
      // jsdom resolves inline styles; since jsdom doesn't load CSS files, we
      // check the inline style set directly by the component.
      expect(nav!.getAttribute('style')).toContain('position: fixed')
    })

    it('has bottom padding using env(safe-area-inset-bottom) on the nav', () => {
      const { container } = renderTabBar('/')
      const nav = container.querySelector('nav')
      expect(nav).not.toBeNull()
      const style = nav!.getAttribute('style') ?? ''
      // The component uses the --safe-b CSS variable (defined in tokens.css as
      // env(safe-area-inset-bottom, 0px)) for safe-area-aware padding. jsdom
      // preserves var() in inline styles but strips env(), so we assert the
      // variable reference which also includes env() as a fallback.
      expect(style).toContain('var(--safe-b')
    })

    it('each tab link has min-height of at least 44px', () => {
      const { container } = renderTabBar('/')
      const links = container.querySelectorAll('a[href]')
      expect(links.length).toBeGreaterThanOrEqual(3)
      links.forEach((link) => {
        const style = (link as HTMLElement).getAttribute('style') ?? ''
        // Link must declare a min-height >= 44 inline, or we check a data attribute
        // The component sets minHeight inline on each tab
        expect(style).toMatch(/min-height:\s*44px/)
      })
    })
  })
})
