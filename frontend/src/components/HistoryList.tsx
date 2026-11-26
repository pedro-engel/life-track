import type { SessionResponse } from '../api/types'

interface HistoryListProps {
  sessions: SessionResponse[]
  templateNames: Map<number, string>
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Session history list — most-recent-first (order comes from the API).
 * Each row shows the date and template name (or "Treino livre" for free sessions).
 */
export function HistoryList({ sessions, templateNames }: HistoryListProps) {
  if (sessions.length === 0) {
    return (
      <p style={{ color: 'var(--muted)', fontSize: 'var(--fs-body)', margin: 0 }}>
        Nenhum treino registrado ainda.
      </p>
    )
  }

  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {sessions.map(session => {
        const name =
          session.template_id != null
            ? (templateNames.get(session.template_id) ?? 'Treino livre')
            : 'Treino livre'
        const dateStr = formatDate(session.started_at)
        return (
          <li
            key={session.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: '1px solid var(--rule)',
            }}
          >
            <span style={{ fontWeight: 500, fontSize: 'var(--fs-body)' }}>{name}</span>
            <span style={{ color: 'var(--muted)', fontSize: 'var(--fs-small)' }}>{dateStr}</span>
          </li>
        )
      })}
    </ul>
  )
}
