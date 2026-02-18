import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

const ProjectAssignments = () => {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [assignments, setAssignments] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [selectedCollaborator, setSelectedCollaborator] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
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
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('role', ['collaborator', 'manager'])
      .eq('is_active', true)
      .order('last_name', { ascending: true })
    
    if (error) console.error('Erreur users:', error)
    if (data) setUsers(data)
  }

  const loadProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true })
    
    if (error) console.error('Erreur projects:', error)
    if (data) setProjects(data)
  }

  const loadAssignments = async () => {
    const { data, error } = await supabase
      .from('project_assignments')
      .select(`
        *,
        project:projects(id, name, code, client),
        user:users!user_id(id, first_name, last_name, email, department)
      `)
    
    if (error) console.error('Erreur assignments:', error)
    if (data) setAssignments(data)
  }

  const getProjectUsers = (projectId) => {
    return assignments
      .filter(a => a.project_id === projectId)
      .map(a => a.user)
      .filter(Boolean)
  }

  const handleOpenAssignModal = () => {
    setShowModal(true)
    setSelectedCollaborator(null)
    setSelectedProject(null)
    setAvailableProjects([])
  }

  const handleCollaboratorSelect = (userId) => {
    setSelectedCollaborator(userId)
    
    // Trouver les projets non assignés à cet utilisateur
    const userProjectIds = assignments
      .filter(a => a.user_id === userId)
      .map(a => a.project_id)
    
    const available = projects.filter(p => !userProjectIds.includes(p.id))
    setAvailableProjects(available)
    setSelectedProject(null)
  }

  const handleAssign = async () => {
    if (!selectedCollaborator || !selectedProject) {
      setMessage({ type: 'error', text: 'Sélectionnez un collaborateur et un projet' })
      return
    }

    try {
      const { error } = await supabase
        .from('project_assignments')
        .insert([{
          user_id: selectedCollaborator,
          project_id: selectedProject,
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
      await loadAssignments()
      setShowModal(false)
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Erreur:', error)
      setMessage({ type: 'error', text: 'Erreur lors de l\'assignation' })
    }
  }

  const handleRemoveAssignment = async (userId, projectId) => {
    if (!confirm('Retirer cette assignation ?')) return

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

  // Grouper les assignations par projet
  const projectsWithAssignments = projects.map(project => ({
    ...project,
    assignedUsers: getProjectUsers(project.id)
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Chargement...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attribution des Projets</h1>
          <p className="text-gray-600">Assignez des projets aux collaborateurs</p>
        </div>
        <button
          onClick={handleOpenAssignModal}
          className="btn-primary"
        >
          ➕ Assigner un projet
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-600 mb-1">Total projets</p>
            <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-600 mb-1">Assignations</p>
            <p className="text-2xl font-bold text-salesforce-blue">{assignments.length}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-600 mb-1">Collaborateurs</p>
            <p className="text-2xl font-bold text-gray-900">{users.length}</p>
          </div>
        </div>
      </div>

      {/* Liste des projets */}
      {projectsWithAssignments.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <div className="text-6xl mb-4">📁</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucun projet</h3>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="divide-y divide-gray-200">
            {projectsWithAssignments.map(project => (
              <ProjectRow
                key={project.id}
                project={project}
                onRemoveAssignment={handleRemoveAssignment}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modal d'assignation */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900">Assigner un projet</h2>
            </div>

            <div className="p-6 space-y-4">
              {/* Sélection collaborateur */}
              <div>
                <label className="label-salesforce">Collaborateur *</label>
                <select
                  value={selectedCollaborator || ''}
                  onChange={(e) => handleCollaboratorSelect(e.target.value)}
                  className="input-salesforce"
                >
                  <option value="">Sélectionner un collaborateur</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.role === 'manager' ? 'Manager' : 'Collaborateur'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Sélection projet */}
              <div>
                <label className="label-salesforce">Projet *</label>
                <select
                  value={selectedProject || ''}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="input-salesforce"
                  disabled={!selectedCollaborator}
                >
                  <option value="">
                    {selectedCollaborator 
                      ? 'Sélectionner un projet' 
                      : 'Sélectionnez d\'abord un collaborateur'}
                  </option>
                  {availableProjects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code}) {p.client && `- ${p.client}`}
                    </option>
                  ))}
                </select>
                {selectedCollaborator && availableProjects.length === 0 && (
                  <p className="text-sm text-orange-600 mt-2">
                    Tous les projets sont déjà assignés à ce collaborateur
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={handleAssign}
                disabled={!selectedCollaborator || !selectedProject}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✅ Assigner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Composant de ligne projet avec expand/collapse
const ProjectRow = ({ project, onRemoveAssignment }) => {
  const [expanded, setExpanded] = useState(false)

  const assignedCount = project.assignedUsers?.length || 0

  return (
    <div className="border-l-4 border-l-salesforce-blue hover:bg-gray-50 transition-colors">
      {/* Ligne compacte */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Info projet */}
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 hover:text-gray-600 transition-transform"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>

            <div className="flex-1">
              <h3 className="font-bold text-gray-900">{project.name}</h3>
              <p className="text-sm text-gray-600">
                Code : {project.code}
                {project.client && ` • Client : ${project.client}`}
              </p>
            </div>
          </div>

          {/* Badge assignations */}
          <div className="text-right">
            <span className={`badge ${assignedCount > 0 ? 'badge-blue' : 'badge-gray'}`}>
              {assignedCount} collaborateur{assignedCount > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Détails expandables */}
      {expanded && (
        <div className="px-6 pb-4 border-t border-gray-200 bg-gray-50">
          <div className="pt-4">
            <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">
              Collaborateurs assignés
            </h4>

            {assignedCount > 0 ? (
              <div className="space-y-2">
                {project.assignedUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200">
                    <div>
                      <p className="font-medium text-gray-900">
                        {u.first_name} {u.last_name}
                      </p>
                      <p className="text-sm text-gray-600">{u.email}</p>
                      {u.department && (
                        <span className="inline-block mt-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          {u.department}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onRemoveAssignment(u.id, project.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      ❌ Retirer
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm italic">Aucun collaborateur assigné à ce projet</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectAssignments