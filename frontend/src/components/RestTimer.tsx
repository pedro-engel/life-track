import { useEffect, useRef, useState } from 'react'

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
 *
 * `onSkip` is captured in a ref so a prop-identity change (parent re-render /
 * forceUpdate creating a new function) never clears and restarts the countdown.
 */
export default function RestTimer({ seconds, onSkip }: RestTimerProps) {
  const [remaining, setRemaining] = useState(seconds)

  // Always hold the latest callback — updated synchronously on every render
  const onSkipRef = useRef(onSkip)
  useEffect(() => {
    onSkipRef.current = onSkip
  }, [onSkip])

  // Countdown effect: depends only on `remaining`, never on `onSkip` identity.
  // A new function reference from the parent does NOT restart the interval.
  useEffect(() => {
    if (remaining <= 0) {
      onSkipRef.current()
      return
    }
    const timer = setTimeout(() => {
      setRemaining((r) => r - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [remaining])

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
