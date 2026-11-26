import { useEffect, useState } from 'react'

interface RestTimerProps {
  seconds: number
  onSkip: () => void
}

function formatTime(total: number): string {
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Pinned rest-timer pill. Counts down from `seconds`; calls `onSkip` when
 * the timer reaches zero or the user taps "Pular".
 */
export default function RestTimer({ seconds, onSkip }: RestTimerProps) {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    if (remaining <= 0) {
      onSkip()
      return
    }
    const timer = setTimeout(() => {
      setRemaining((r) => r - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [remaining, onSkip])

  return (
    <div className="rest" role="timer" aria-label="Descanso">
      <div>
        <div className="t">{formatTime(remaining)}</div>
        <div className="lbl">descanso — próxima série</div>
      </div>
      <button type="button" onClick={onSkip} aria-label="Pular descanso">
        Pular
      </button>
    </div>
  )
}
