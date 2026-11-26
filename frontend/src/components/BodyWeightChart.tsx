import type { BodyWeightOut } from '../api/types'

// ---------------------------------------------------------------------------
// Chart geometry constants
// ---------------------------------------------------------------------------

const W = 300
const H = 150
const PAD = { t: 10, r: 10, b: 32, l: 32 }

function scaleX(ts: number, minTs: number, range: number): number {
  if (range === 0) return PAD.l + (W - PAD.l - PAD.r) / 2
  return PAD.l + ((ts - minTs) / range) * (W - PAD.l - PAD.r)
}

function scaleY(val: number, yMin: number, yMax: number): number {
  const range = yMax - yMin
  if (range === 0) return PAD.t + (H - PAD.t - PAD.b) / 2
  return H - PAD.b - ((val - yMin) / range) * (H - PAD.t - PAD.b)
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BodyWeightChartProps {
  entries: BodyWeightOut[]
  /** Left edge of the shared time axis. */
  xMin: Date
  /** Right edge of the shared time axis. */
  xMax: Date
}

// ---------------------------------------------------------------------------
// BodyWeightChart
// ---------------------------------------------------------------------------

/**
 * Body-weight over time chart.
 * Shares the same xMin/xMax as ProgressChart so both charts align on a common
 * time axis (the spec's "mesma linha do tempo").
 * Teal data line; faint grid; no legend (single series).
 */
export function BodyWeightChart({ entries, xMin, xMax }: BodyWeightChartProps) {
  if (entries.length === 0) {
    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Peso corporal (kg)"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
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
        <text
          x={(PAD.l + W - PAD.r) / 2}
          y={(PAD.t + H - PAD.b) / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--muted)"
          fontSize={12}
          fontFamily="var(--font)"
        >
          Nenhuma pesagem ainda
        </text>
      </svg>
    )
  }

  const weights = entries.map(e => e.weight)
  const rawYMin = Math.min(...weights)
  const rawYMax = Math.max(...weights)
  const padY = (rawYMax - rawYMin) * 0.1 || rawYMax * 0.02 || 2
  const yMin = rawYMin - padY
  const yMax = rawYMax + padY

  const minTs = xMin.getTime()
  const tsRange = xMax.getTime() - minTs

  const pts = entries.map(e => ({
    x: scaleX(new Date(e.recorded_at).getTime(), minTs, tsRange),
    y: scaleY(e.weight, yMin, yMax),
  }))

  const polylinePoints = pts.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Peso corporal (kg)"
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {/* Faint grid lines */}
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

      {/* Data line — teal only */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinejoin="round"
        data-testid="bw-line"
      />

      {/* Data points */}
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={4}
          fill="var(--accent)"
          data-testid="bw-point"
        />
      ))}
    </svg>
  )
}
