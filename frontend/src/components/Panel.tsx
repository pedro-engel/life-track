import type { ReactNode } from 'react'

interface PanelProps {
  title?: string
  meta?: string | ReactNode
  children: ReactNode
}

/** Generic card panel — matches the .panel class from life.css tokens. */
export function Panel({ title, meta, children }: PanelProps) {
  return (
    <section className="panel">
      {(title || meta) && (
        <header>
          {title && <h2>{title}</h2>}
          {meta && <span className="meta">{meta}</span>}
        </header>
      )}
      {children}
    </section>
  )
}
