import { Navigate } from 'react-router-dom'
import { getToken } from '../auth/token'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/** Redirects to /login when there is no stored token. */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  if (!getToken()) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
