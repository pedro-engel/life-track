import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import './styles/tokens.css'
import { AuthProvider } from './auth/useAuth'
import { ProtectedRoute } from './components/ProtectedRoute'
import CycleEditor from './screens/editors/CycleEditor'
import Exercises from './screens/editors/Exercises'
import Templates from './screens/editors/Templates'
import Login from './screens/Login'
import Progress from './screens/Progress'
import Today from './screens/Today'
import Workout from './screens/Workout'

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

      {/* Protected: Today screen at / and /today */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Today />
          </ProtectedRoute>
        }
      />
      <Route
        path="/today"
        element={
          <ProtectedRoute>
            <Today />
          </ProtectedRoute>
        }
      />

      {/* Editors — protected */}
      <Route
        path="/editors/exercises"
        element={
          <ProtectedRoute>
            <Exercises />
          </ProtectedRoute>
        }
      />
      <Route
        path="/editors/templates"
        element={
          <ProtectedRoute>
            <Templates />
          </ProtectedRoute>
        }
      />
      <Route
        path="/editors/cycle"
        element={
          <ProtectedRoute>
            <CycleEditor />
          </ProtectedRoute>
        }
      />

      {/* Catch-all — redirect unknown paths to root */}
      <Route path="*" element={<Navigate to="/" replace />} />

      {/* Workout screen — protected, carries templateId + stepPosition as route state */}
      <Route
        path="/workout"
        element={
          <ProtectedRoute>
            <Workout />
          </ProtectedRoute>
        }
      />

      {/* Progress screen — protected */}
      <Route
        path="/progress"
        element={
          <ProtectedRoute>
            <Progress />
          </ProtectedRoute>
        }
      />
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
