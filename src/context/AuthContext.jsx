import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

// El token dura 12h. Si venció no se restaura la sesión: la pantalla se
// mostraba logueada y todas las llamadas a la API daban 401.
function tokenVigente(token) {
  if (!token) return false
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(base64))
    return !exp || exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      if (!tokenVigente(localStorage.getItem('token'))) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        return null
      }
      const raw = localStorage.getItem('user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const login = (token, userData) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
