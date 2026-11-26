/**
 * TabBar — fixed bottom navigation bar for life-track.
 *
 * Three destinations:
 *  - Hoje  → /
 *  - Progresso → /progress
 *  - Editar → /editors/exercises (entry point to all editors)
 *
 * Design requirements:
 *  - position: fixed, bottom: 0, full width
 *  - ≥44px min-height on each tab (touch target)
 *  - padding-bottom: env(safe-area-inset-bottom) for iPhone home indicator
 *  - teal accent on the active tab only (marker dot / color)
 *  - clean white bar, no shadows at rest (matches the prototype's calm aesthetic)
 */
import { Link, useLocation } from 'react-router-dom'

interface Tab {
  label: string
  href: string
  /** Returns true when this tab should be highlighted for the given pathname */
  isActive: (pathname: string) => boolean
}

const TABS: Tab[] = [
  {
    label: 'Hoje',
    href: '/',
    isActive: (p) => p === '/' || p === '/today' || p === '/workout',
  },
  {
    label: 'Progresso',
    href: '/progress',
    isActive: (p) => p === '/progress',
  },
  {
    label: 'Editar',
    href: '/editors/exercises',
    isActive: (p) => p.startsWith('/editors/'),
  },
]

export default function TabBar() {
  const { pathname } = useLocation()

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        backgroundColor: 'var(--raised, #fff)',
        borderTop: '1px solid var(--border, #eaeaea)',
        paddingBottom: 'var(--safe-b, env(safe-area-inset-bottom, 0px))',
        zIndex: 100,
      }}
      aria-label="Navegação principal"
    >
      {TABS.map((tab) => {
        const active = tab.isActive(pathname)
        return (
          <Link
            key={tab.href}
            to={tab.href}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '44px',
              textDecoration: 'none',
              color: active ? 'var(--accent, #1b6e66)' : 'var(--muted, #636361)',
              fontFamily: 'var(--font, system-ui, sans-serif)',
              fontSize: '11px',
              fontWeight: active ? 600 : 400,
              paddingTop: '8px',
              paddingBottom: '8px',
              gap: '3px',
              position: 'relative',
            }}
          >
            {active && (
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '24px',
                  height: '2px',
                  borderRadius: '0 0 2px 2px',
                  backgroundColor: 'var(--accent, #1b6e66)',
                }}
                aria-hidden="true"
              />
            )}
            <TabIcon name={tab.label} active={active} />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

/** Minimal SVG icons for each tab destination */
function TabIcon({ name, active }: { name: string; active: boolean }) {
  const color = active ? 'var(--accent, #1b6e66)' : 'var(--muted, #636361)'

  if (name === 'Hoje') {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="14" height="13" rx="2" stroke={color} strokeWidth="1.5" />
        <path d="M7 2v4M13 2v4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M3 8h14" stroke={color} strokeWidth="1.5" />
        <rect x="7" y="11" width="2" height="2" rx="0.5" fill={color} />
        <rect x="11" y="11" width="2" height="2" rx="0.5" fill={color} />
      </svg>
    )
  }

  if (name === 'Progresso') {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 15 L7 9 L11 12 L15 5"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="15" cy="5" r="1.5" fill={color} />
      </svg>
    )
  }

  // Editar — pencil icon
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M13.5 3.5 L16.5 6.5 L7 16 L3 17 L4 13 L13.5 3.5Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 5L15 8" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}
