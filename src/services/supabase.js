import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY 

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client admin (créer des users)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})
// Auth
export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

// Users
export const getUserProfile = async (userId) => {
  // 1. Récupérer l'utilisateur
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) return { data: null, error }

  // 2. Si l'utilisateur a un manager, récupérer ses infos
  if (user.manager_id) {
    const { data: manager } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('id', user.manager_id)
      .single()

    if (manager) {
      user.manager = manager
    }
  }

  return { data: user, error: null }
}

// Projects
export const getUserProjects = async (userId) => {
  const { data, error } = await supabase
    .from('project_assignments')
    .select('*, project:projects(*)')
    .eq('user_id', userId)
  return { data, error }
}

// CRA
export const getUserCRAHistory = async (userId) => {
  const { data, error } = await supabase
    .from('cra_submissions')
    .select(`
      *,
      entries:cra_entries(*, project:projects(name, code)),
      validator:users!validated_by(first_name, last_name)
    `)
    .eq('user_id', userId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  return { data, error }
}

export const getPendingCRAs = async () => {
  const { data, error } = await supabase
    .from('cra_submissions')
    .select(`
      *,
      user:users!user_id(id, first_name, last_name, email, department),
      entries:cra_entries(*, project:projects(name, code))
    `)
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: true })
  return { data, error }
}