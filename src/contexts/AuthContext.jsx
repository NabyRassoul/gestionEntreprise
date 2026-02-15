import { createContext, useState, useEffect, useContext } from 'react'
import { supabase, getCurrentUser, getUserProfile } from '../services/supabase'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
      }
    })

    return () => {
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  const checkUser = async () => {
    try {
      const { user, error } = await getCurrentUser()
      if (!error && user) {
        setUser(user)
        await loadProfile(user.id)
      }
    } catch (error) {
      console.error('Erreur check user:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProfile = async (userId) => {
    const { data, error } = await getUserProfile(userId)
    if (!error) {
      setProfile(data)
    }
  }

  const value = {
    user,
    profile,
    loading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}