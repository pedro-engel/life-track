import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import './styles/tokens.css'
import { AuthProvider } from './auth/useAuth'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './screens/Login'

/**
 * AppRoutes — inner component that has access to the router context.
 * Separating this from App lets us call useNavigate() safely.
 */
function AppRoutes() {
  const navigate = useNavigate()

  return (
    <Routes>
      {/* Login — public */}
      <Route
        path="/login"
        element={<Login onAuthenticated={() => navigate('/', { replace: true })} />}
      />

      {/* Protected: placeholder root replaced by the Today screen in Task 3 */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <main style={{ padding: '24px 16px' }}>
              <p>Life Track is loading…</p>
            </main>
          </ProtectedRoute>
        }
      />

      {/* Catch-all — redirect unknown paths to root */}
      <Route path="*" element={<Navigate to="/" replace />} />

      {/* Additional routes will be added here in subsequent tasks */}
    </Routes>
  )
}

/**
 * App — root router shell.
 *
 * Route tree is intentionally minimal for Task 2.
 * Later tasks append <Route> entries inside AppRoutes additively.
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div id="app-root" className="app-phone">
          <AppRoutes />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
