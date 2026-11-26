import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * Redirects to /login when the user is not authenticated.
 * Uses reactive `isAuthenticated` from AuthProvider so it responds to
 * the auth:unauthorized event (401 on a mounted screen) without requiring
 * a navigation event.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
