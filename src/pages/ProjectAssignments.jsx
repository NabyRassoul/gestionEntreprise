import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

const ProjectAssignments = () => {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [assignments, setAssignments] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [availableProjects, setAvailableProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    await Promise.all([
      loadUsers(),
      loadProjects(),
      loadAssignments()
    ])
    setLoading(false)
  }

  const loadUsers = async () => {
  const { data, error } = await supabase  // ← error
    .from('users')
    .select('*')
    .in('role', ['collaborator', 'manager'])
    .eq('is_active', true)
    .order('last_name', { ascending: true })
  
  if (error) console.error('Erreur users:', error)
  if (data) setUsers(data)
}

const loadProjects = async () => {
  const { data, error } = await supabase  // ← error
    .from('projects')
    .select('*')
    .eq('status', 'active')
    .order('name', { ascending: true })
  
  if (error) console.error('Erreur projects:', error)
  if (data) setProjects(data)
}

  const loadAssignments = async () => {
  const { data, error } = await supabase  // ← Ajoutez "error" ici !
    .from('project_assignments')
    .select(`
      *,
      project:projects(id, name, code, client),
      user:users!user_id(id, first_name, last_name, email)
    `)
  

  
  if (data) setAssignments(data)
}

  const getUserProjects = (userId) => {
    return assignments
      .filter(a => a.user_id === userId)
      .map(a => a.project)
      .filter(Boolean)
  }

  const getProjectUsers = (projectId) => {
    return assignments
      .filter(a => a.project_id === projectId)
      .map(a => a.user)
      .filter(Boolean)
  }

  const handleOpenAssignModal = (userToAssign) => {
    setSelectedUser(userToAssign)
    
    // Trouver les projets non encore assignés à cet utilisateur
    const userProjectIds = getUserProjects(userToAssign.id).map(p => p.id)
    const available = projects.filter(p => !userProjectIds.includes(p.id))
    
    setAvailableProjects(available)
    setShowModal(true)
  }

  const handleAssignProject = async (projectId) => {
    try {
      const { error } = await supabase
        .from('project_assignments')
        .insert([{
          user_id: selectedUser.id,
          project_id: projectId,
          assigned_by: user.id
        }])

      if (error) {
        if (error.code === '23505') {
          setMessage({ type: 'error', text: 'Ce projet est déjà assigné à cet utilisateur' })
        } else {
          setMessage({ type: 'error', text: error.message })
        }
        return
      }

      setMessage({ type: 'success', text: 'Projet assigné avec succès !' })
      
      // Recharger toutes les données
      await loadAssignments()
      
      // Fermer le modal
      setShowModal(false)
      setSelectedUser(null)
      setAvailableProjects([])

      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Erreur:', error)
      setMessage({ type: 'error', text: 'Erreur lors de l\'assignation' })
    }
  }

  const handleRemoveAssignment = async (userId, projectId) => {
    if (!confirm('Retirer ce projet à cet utilisateur ?')) return

    try {
      const { error } = await supabase
        .from('project_assignments')
        .delete()
        .eq('user_id', userId)
        .eq('project_id', projectId)

      if (error) throw error

      setMessage({ type: 'success', text: 'Assignation retirée !' })
      await loadAssignments()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Erreur:', error)
      setMessage({ type: 'error', text: 'Erreur lors de la suppression' })
    }
  }

  if (loading) {
    return <div className="p-6">Chargement...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Attribution des Projets</h1>
          <p className="text-gray-600 mt-2">
            Assignez des projets aux collaborateurs et managers
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message.text}
          </div>
        )}

        {/* Vue par utilisateur */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h2 className="text-xl font-semibold">👥 Par Collaborateur</h2>
          </div>
          
          <div className="divide-y">
            {users.map((u) => {
              const userProjects = getUserProjects(u.id)
              return (
                <div key={u.id} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {u.first_name} {u.last_name}
                      </h3>
                      <p className="text-sm text-gray-600">{u.email}</p>
                      <span className="inline-block mt-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {u.role === 'manager' ? 'Manager' : 'Collaborateur'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleOpenAssignModal(u)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      ➕ Assigner un projet
                    </button>
                  </div>

                  <div className="space-y-2">
                    {userProjects.length > 0 ? (
                      userProjects.map((project) => (
                        <div key={project.id} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                          <div>
                            <span className="font-medium">{project.name}</span>
                            <span className="ml-2 text-sm text-gray-600">({project.code})</span>
                            {project.client && (
                              <span className="ml-2 text-sm text-gray-500">- {project.client}</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveAssignment(u.id, project.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            ❌ Retirer
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm italic">Aucun projet assigné</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Vue par projet */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h2 className="text-xl font-semibold">📁 Par Projet</h2>
          </div>
          
          <div className="divide-y">
            {projects.map((project) => {
              const projectUsers = getProjectUsers(project.id)
              return (
                <div key={project.id} className="p-6 hover:bg-gray-50">
                  <div className="mb-3">
                    <h3 className="font-semibold text-lg">{project.name}</h3>
                    <p className="text-sm text-gray-600">
                      Code : {project.code}
                      {project.client && ` • Client : ${project.client}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {projectUsers.length > 0 ? (
                      projectUsers.map((u) => (
                        <div key={u.id} className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                          <span>{u.first_name} {u.last_name}</span>
                          <button
                            onClick={() => handleRemoveAssignment(u.id, project.id)}
                            className="text-red-600 hover:text-red-800 ml-1"
                            title="Désigner cette personne"
                          >
                            ❌
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm italic">Aucun collaborateur assigné</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Modal d'assignation */}
        {showModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">
                Assigner un projet à {selectedUser.first_name} {selectedUser.last_name}
              </h2>

              {availableProjects.length > 0 ? (
                <div className="space-y-2">
                  {availableProjects.map((project) => (
                    <div
                      key={project.id}
                      className="flex justify-between items-center p-4 border rounded hover:bg-gray-50"
                    >
                      <div>
                        <div className="font-medium">{project.name}</div>
                        <div className="text-sm text-gray-600">
                          {project.code}
                          {project.client && ` • ${project.client}`}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAssignProject(project.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Assigner
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  Tous les projets sont déjà assignés à cet utilisateur
                </p>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProjectAssignments