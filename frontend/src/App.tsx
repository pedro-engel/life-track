import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './styles/tokens.css'
import { AuthProvider } from './auth/useAuth'
import { ProtectedRoute } from './components/ProtectedRoute'
import TabBar from './components/TabBar'
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
 *
 * The TabBar is shown on all protected screens (not on the Login screen).
 * Page content gets paddingBottom to avoid being hidden behind the fixed bar.
 */
function AppRoutes() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Show the TabBar on all protected routes (not on /login)
  const showTabBar = pathname !== '/login'

  return (
    <>
      {/* Page content wrapper — adds bottom padding so content clears the TabBar */}
      <div
        style={{
          paddingBottom: showTabBar
            ? 'calc(60px + var(--safe-b, env(safe-area-inset-bottom, 0px)))'
            : undefined,
        }}
      >
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

          {/* Catch-all — redirect unknown paths to root */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {/* Fixed bottom navigation — hidden on the Login screen */}
      {showTabBar && <TabBar />}
    </>
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
