import { createContext, useCallback, useContext, useState } from 'react'
import { clearToken, getToken, setToken } from './token'

interface AuthContextValue {
  isAuthenticated: boolean
  signIn: (token: string) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken())

  const signIn = useCallback((token: string) => {
    setToken(token)
    setIsAuthenticated(true)
  }, [])

  const signOut = useCallback(() => {
    clearToken()
    setIsAuthenticated(false)
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
