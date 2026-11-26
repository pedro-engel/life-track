interface GreetingProps {
  /** Whether to show the night variant ("Boa noite"). */
  isNight: boolean
  /**
   * Pre-formatted date string (e.g. "quinta-feira, 26 de novembro").
   * Computed once in Today.tsx alongside isNight so the two are always
   * derived from the same Date instance and cannot straddle midnight.
   */
  dateStr: string
  /** Template name for today's step (lowercase in line). null for run/rest. */
  templateName: string | null
  /** Template name for tomorrow's step. null if unknown. */
  nextTemplateName: string | null
}

/**
 * Serif editorial greeting.
 * Morning: "Bom dia, Pedro.\n[date]. Hoje é dia de **peito**."
 * Night:   "Boa noite, Pedro.\nAmanhã é dia de **costas**."
 */
export function Greeting({ isNight, dateStr, templateName, nextTemplateName }: GreetingProps) {
  return (
    <section className="greeting">
      <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: '28px', lineHeight: 1.08, margin: 0, color: 'var(--text)' }}>
        {isNight ? 'Boa noite, Pedro.' : 'Bom dia, Pedro.'}
      </h1>
      <p className="line" style={{ marginTop: '8px', color: 'var(--muted)', fontSize: 'var(--fs-body)' }}>
        {isNight ? (
          nextTemplateName ? (
            <>Amanhã é dia de <b>{nextTemplateName.toLowerCase()}</b>.</>
          ) : (
            <>{dateStr}.</>
          )
        ) : (
          <>
            {dateStr}.{' '}
            {templateName && (
              <>Hoje é dia de <b>{templateName.toLowerCase()}</b>.</>
            )}
          </>
        )}
      </p>
    </section>
  )
}
