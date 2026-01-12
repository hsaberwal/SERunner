import { createContext, useContext, useState, useEffect } from 'react'
import { auth } from '../services/api'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token')
      if (token) {
        try {
          const response = await auth.me()
          setUser(response.data)
        } catch (error) {
          localStorage.removeItem('token')
        }
      }
      setLoading(false)
    }

    loadUser()
  }, [])

  const login = async (email, password) => {
    const response = await auth.login({ email, password })
    const { access_token, is_admin } = response.data
    localStorage.setItem('token', access_token)
    localStorage.setItem('is_admin', is_admin ? 'true' : 'false')
    const userResponse = await auth.me()
    setUser(userResponse.data)
  }

  const register = async (email, password) => {
    const response = await auth.register({ email, password })
    // New users need approval - don't log them in automatically
    return response.data  // Returns { message, pending_approval }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('is_admin')
    setUser(null)
  }

  const isAdmin = user?.is_admin || false

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
