import React, { createContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext()

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

// Session persistante (localStorage) ou limitée à l'onglet (sessionStorage)
const storage = {
  get: (key) => localStorage.getItem(key) ?? sessionStorage.getItem(key),
  set: (key, value, remember) => {
    ;(remember ? localStorage : sessionStorage).setItem(key, value)
    ;(remember ? sessionStorage : localStorage).removeItem(key)
  },
  isPersistent: () => !!localStorage.getItem(TOKEN_KEY),
  clear: () => {
    ;[localStorage, sessionStorage].forEach((s) => {
      s.removeItem(TOKEN_KEY)
      s.removeItem(USER_KEY)
    })
  },
}

const readCachedUser = () => {
  try {
    return JSON.parse(storage.get(USER_KEY))
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  

  // Initialisation synchrone : pas de "flash" vers /login au rafraîchissement
  const [token, setToken] = useState(() => storage.get(TOKEN_KEY))
  const [user, setUser] = useState(() => (storage.get(TOKEN_KEY) ? readCachedUser() : null))
  const [loading, setLoading] = useState(() => !!storage.get(TOKEN_KEY) && !readCachedUser())

  const clearSession = useCallback(() => {
    storage.clear()
    setToken(null)
    setUser(null)
  }, [])

    // Met à jour l'utilisateur et/ou le token (après modification du profil ou du mot de passe)
  const updateSession = useCallback(({ token: newToken, user: newUser }) => {
    const remember = storage.isPersistent()
    if (newToken) {
      storage.set(TOKEN_KEY, newToken, remember)
      setToken(newToken)
    }
    if (newUser) {
      storage.set(USER_KEY, JSON.stringify(newUser), remember)
      setUser(newUser)
    }
  }, [])

  // Rafraîchit les infos utilisateur ; ne déconnecte QUE si le token est invalide
  const refreshUser = useCallback(
    async (authToken = storage.get(TOKEN_KEY)) => {
      if (!authToken) {
        setLoading(false)
        return
      }
      try {
        const r = await fetch(`${API_URL}/api/auth/me/`, {
          headers: { Authorization: `Token ${authToken}` },
        })
        if (r.status === 401 || r.status === 403) {
          clearSession()
          return
        }
        if (r.ok) {
          const u = await r.json()
          setUser(u)
          storage.set(USER_KEY, JSON.stringify(u), storage.isPersistent())
        }
      } catch {
        console.warn('Serveur injoignable — session conservée')
      } finally {
        setLoading(false)
      }
    },
    [API_URL, clearSession]
  )

  useEffect(() => {
    refreshUser()
  }, [refreshUser])
  // Token refusé par l'API (401) → on vide la session, PrivateRoute renvoie au login
  useEffect(() => {
    const onUnauthorized = () => clearSession()
    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized)
  }, [clearSession])
  const login = async (email, password, remember = true) => {
    let r
    try {
      r = await fetch(`${API_URL}/api/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    } catch {
      const e = new Error('Serveur injoignable')
      e.code = 'network'
      throw e
    }

    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      const e = new Error(data.error || 'Échec de connexion')
      e.status = r.status
      throw e
    }

    storage.set(TOKEN_KEY, data.token, remember)
    storage.set(USER_KEY, JSON.stringify(data.user), remember)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}` },
      })
    } catch {
      // on déconnecte côté front quoi qu'il arrive
    } finally {
      clearSession()
    }
  }

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    refreshUser,
    updateSession,
    isAuthenticated: !!token && !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}