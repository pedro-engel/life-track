import type { ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Shared chart geometry — single source of truth for both stacked charts.
// ---------------------------------------------------------------------------

export const W = 300
export const H = 150
export const PAD = { t: 10, r: 10, b: 32, l: 32 }

/** Map a timestamp to an x pixel, clamped to the drawable area. */
export function scaleX(ts: number, minTs: number, range: number): number {
  if (range === 0) return PAD.l + (W - PAD.l - PAD.r) / 2
  return PAD.l + ((ts - minTs) / range) * (W - PAD.l - PAD.r)
}

/** Map a data value to a y pixel (SVG coords: 0 at top, so invert). */
export function scaleY(val: number, yMin: number, yMax: number): number {
  const range = yMax - yMin
  if (range === 0) return PAD.t + (H - PAD.t - PAD.b) / 2
  return H - PAD.b - ((val - yMin) / range) * (H - PAD.t - PAD.b)
}

// ---------------------------------------------------------------------------
// ChartBase — SVG wrapper shared by ProgressChart and BodyWeightChart.
// Renders: role="img" wrapper, two faint axis lines, and either
// an empty-state text label or the chart content supplied by the caller.
// ---------------------------------------------------------------------------

interface ChartBaseProps {
  /** Accessible name placed on the SVG via aria-label. */
  ariaLabel: string
  /** When provided the chart renders its empty-state frame with this text instead of children. */
  emptyText?: string
  children?: ReactNode
}

export function ChartBase({ ariaLabel, emptyText, children }: ChartBaseProps) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={ariaLabel}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {/* Faint y-axis + x-axis lines */}
      <line
        x1={PAD.l} y1={PAD.t}
        x2={PAD.l} y2={H - PAD.b}
        stroke="var(--grid)" strokeWidth={1}
      />
      <line
        x1={PAD.l} y1={H - PAD.b}
        x2={W - PAD.r} y2={H - PAD.b}
        stroke="var(--grid)" strokeWidth={1}
      />

      {emptyText ? (
        <text
          x={(PAD.l + W - PAD.r) / 2}
          y={(PAD.t + H - PAD.b) / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--muted)"
          fontSize={12}
          fontFamily="var(--font)"
        >
          {emptyText}
        </text>
      ) : (
        children
      )}
    </svg>
  )
}
