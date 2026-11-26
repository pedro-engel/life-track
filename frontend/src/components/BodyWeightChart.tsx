import type { BodyWeightOut } from '../api/types'
import { ChartBase, scaleX, scaleY } from './ChartBase'

interface BodyWeightChartProps {
  entries: BodyWeightOut[]
  /** Left edge of the shared time axis. */
  xMin: Date
  /** Right edge of the shared time axis. */
  xMax: Date
}

/**
 * Body-weight over time chart.
 * Shares the same xMin/xMax as ProgressChart so both charts align on a common
 * time axis (the spec's "mesma linha do tempo").
 * Teal data line; faint grid; no legend (single series).
 */
export function BodyWeightChart({ entries, xMin, xMax }: BodyWeightChartProps) {
  if (entries.length === 0) {
    return (
      <ChartBase
        ariaLabel="Peso corporal (kg)"
        emptyText="Nenhuma pesagem ainda"
      />
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
    <ChartBase ariaLabel="Peso corporal (kg)">
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
    </ChartBase>
  )
}
