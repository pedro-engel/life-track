import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './styles/tokens.css'

/**
 * App — root router shell.
 *
 * Route tree is intentionally minimal for Task 1.
 * Later tasks append <Route> entries here additively.
 */
function App() {
  return (
    <BrowserRouter>
      <div id="app-root" className="app-phone">
        <Routes>
          {/* Placeholder root route — replaced by the Today screen in Task 2 */}
          <Route
            path="/"
            element={
              <main style={{ padding: '24px 16px' }}>
                <p>Life Track is loading…</p>
              </main>
            }
          />
          {/* Additional routes will be added here in subsequent tasks */}
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
