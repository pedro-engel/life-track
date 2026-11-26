import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App shell', () => {
  it('renders app shell with root element', () => {
    const { container } = render(<App />)
    // The app should render a root wrapper element
    expect(container.firstChild).toBeTruthy()
  })

  it('references Instrument Sans font family on document.body', () => {
    render(<App />)
    // tokens.css is imported in App.tsx; with css:true in vite test config,
    // the stylesheet is injected into jsdom and computed styles are applied.
    // The body rule sets font-family directly to the Instrument Sans string.
    const fontFamily = window.getComputedStyle(document.body).fontFamily
    expect(fontFamily).toContain('Instrument Sans')
  })
})
