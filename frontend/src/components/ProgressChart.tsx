import type { ProgressPoint } from '../api/types'
import { ChartBase, PAD, W, scaleX, scaleY } from './ChartBase'

interface ProgressChartProps {
  points: ProgressPoint[]
  /** Left edge of the shared time axis (union of both series). */
  xMin: Date
  /** Right edge of the shared time axis. */
  xMax: Date
}

/**
 * Per-exercise progress chart (top weight over time).
 * Uses the shared xMin/xMax so both stacked charts share the same time axis.
 * Teal data line; faint grid; no legend (single series).
 */
export function ProgressChart({ points, xMin, xMax }: ProgressChartProps) {
  if (points.length === 0) {
    return (
      <ChartBase
        ariaLabel="Progressão: peso máximo (kg)"
        emptyText="Sem histórico ainda"
      />
    )
  }

  const weights = points.map(p => p.top_weight)
  const rawYMin = Math.min(...weights)
  const rawYMax = Math.max(...weights)
  const pad = (rawYMax - rawYMin) * 0.1 || rawYMax * 0.05 || 5
  const yMin = rawYMin - pad
  const yMax = rawYMax + pad

  const minTs = xMin.getTime()
  const tsRange = xMax.getTime() - minTs

  const pts = points.map(p => ({
    x: scaleX(new Date(p.date).getTime(), minTs, tsRange),
    y: scaleY(p.top_weight, yMin, yMax),
  }))

  const polylinePoints = pts.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <ChartBase ariaLabel="Progressão: peso máximo (kg)">
      {/* Data line — teal only */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Data points */}
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={4}
          fill="var(--accent)"
          data-testid="progress-point"
        />
      ))}
    </ChartBase>
  )
}

// Re-export shared constants so callers that import from ProgressChart still work.
export { W, PAD }
