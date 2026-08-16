import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/authApi.js'
import { getToken, setToken as persistToken, setAuthErrorHandler } from '../api/client.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [token, setTokenState] = useState(() => getToken())
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(getToken()))

  const clearAuth = useCallback(() => {
    persistToken(null)
    setTokenState(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(() => {
    return authApi
      .me()
      .then((u) => {
        setUser(u)
        return u
      })
      .catch((err) => {
        clearAuth()
        throw err
      })
  }, [clearAuth])

  // Registered once so the API client can react to a session-ending 401, or a 403
  // PASSWORD_CHANGE_REQUIRED, from ANY request without every call site handling it manually.
  useEffect(() => {
    setAuthErrorHandler((err) => {
      if (err.status === 401) {
        clearAuth()
        navigate('/login', { replace: true })
      } else if (err.status === 403 && err.code === 'PASSWORD_CHANGE_REQUIRED') {
        navigate('/change-password', { replace: true })
      }
    })
  }, [clearAuth, navigate])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    refreshUser().finally(() => setLoading(false))
    // Only re-validate on mount / explicit token change, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function login(email, password) {
    const { token: newToken, user: newUser } = await authApi.login(email, password)
    persistToken(newToken)
    setTokenState(newToken)
    setUser(newUser)
    return newUser
  }

  function logout() {
    clearAuth()
    navigate('/login', { replace: true })
  }

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    loading,
    login,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
