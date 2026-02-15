import { useState, useEffect } from 'react'
import { supabase, supabaseAdmin } from '../services/supabase'

const UsersManagement = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [message, setMessage] = useState(null)
  const [managers, setManagers] = useState([])

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone_whatsapp: '',
    role: 'collaborator',
    department: '',
    manager_id: ''
  })

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
  setLoading(true)
  
  // 1. Charger tous les utilisateurs
  const { data: usersData, error } = await supabase
    .from('users')
    .select('*')
    .order('last_name', { ascending: true })

  if (error) {
    console.error('Erreur chargement users:', error)
    setLoading(false)
    return
  }

  // 2. Pour chaque user avec un manager, récupérer les infos du manager
  const usersWithManagers = await Promise.all(
    usersData.map(async (user) => {
      if (user.manager_id) {
        const { data: managerData } = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .eq('id', user.manager_id)
          .single()
        
        return { ...user, manager: managerData }
      }
      return user
    })
  )

  setUsers(usersWithManagers)
  
  // Extraire les managers pour le dropdown
  const managersList = usersWithManagers.filter(u => u.role === 'manager' || u.role === 'admin')
  setManagers(managersList)
  
  setLoading(false)
}
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      phone_whatsapp: '',
      role: 'collaborator',
      department: '',
      manager_id: ''
    })
    setEditingUser(null)
  }

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user)
      setFormData({
        email: user.email || '',
        password: '', // Ne pas préremplir le mot de passe
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone_whatsapp: user.phone_whatsapp || '',
        role: user.role || 'collaborator',
        department: user.department || '',
        manager_id: user.manager_id || ''
      })
    } else {
      resetForm()
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    resetForm()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage(null)

    // Validation
    if (!formData.email || !formData.first_name || !formData.last_name) {
      setMessage({ type: 'error', text: 'Email, prénom et nom sont obligatoires' })
      return
    }

    if (!editingUser && !formData.password) {
      setMessage({ type: 'error', text: 'Le mot de passe est obligatoire pour un nouvel utilisateur' })
      return
    }

    try {
      if (editingUser) {
        // Mise à jour utilisateur existant
        const { error } = await supabase
          .from('users')
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            phone_whatsapp: formData.phone_whatsapp,
            role: formData.role,
            department: formData.department,
            manager_id: formData.manager_id || null
          })
          .eq('id', editingUser.id)

        if (error) throw error

        setMessage({ type: 'success', text: 'Utilisateur modifié avec succès !' })
      } else {
        // Création nouvel utilisateur
        
        // 1. Créer dans Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: formData.email,
          password: formData.password,
          email_confirm: true
        })

        if (authError) throw authError

        // 2. Créer dans la table users avec le même UUID
        const { error: userError } =  await supabaseAdmin 
          .from('users')
          .insert([{
            id: authData.user.id, // Utiliser l'UUID de Auth
            email: formData.email,
            first_name: formData.first_name,
            last_name: formData.last_name,
            phone_whatsapp: formData.phone_whatsapp,
            role: formData.role,
            department: formData.department,
            manager_id: formData.manager_id || null
          }])

        if (userError) throw userError

        setMessage({ type: 'success', text: 'Utilisateur créé avec succès !' })
      }

      loadUsers()
      handleCloseModal()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Erreur:', error)
      setMessage({ type: 'error', text: error.message || 'Erreur lors de la sauvegarde' })
    }
  }

  const handleToggleActive = async (userId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus })
        .eq('id', userId)

      if (error) throw error

      setMessage({ 
        type: 'success', 
        text: currentStatus ? 'Utilisateur désactivé' : 'Utilisateur activé' 
      })
      loadUsers()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Erreur:', error)
      setMessage({ type: 'error', text: 'Erreur lors de la modification' })
    }
  }

  const getRoleBadge = (role) => {
    const badges = {
      admin: 'bg-purple-100 text-purple-800',
      manager: 'bg-blue-100 text-blue-800',
      collaborator: 'bg-green-100 text-green-800'
    }
    const labels = {
      admin: 'Admin',
      manager: 'Manager',
      collaborator: 'Collaborateur'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[role] || badges.collaborator}`}>
        {labels[role] || role}
      </span>
    )
  }

  if (loading) {
    return <div className="p-6">Chargement...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Gestion des Utilisateurs</h1>
            <p className="text-gray-600 mt-1">{users.length} utilisateur(s)</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ➕ Nouvel Utilisateur
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message.text}
          </div>
        )}

        {/* Liste des utilisateurs */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisateur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Département</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manager</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className={`hover:bg-gray-50 ${!user.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                    {user.phone_whatsapp && (
                      <div className="text-xs text-gray-400">📱 {user.phone_whatsapp}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{user.department || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {user.manager ? `${user.manager.first_name} ${user.manager.last_name}` : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {user.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => handleOpenModal(user)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      ✏️ Modifier
                    </button>
                    <button
                      onClick={() => handleToggleActive(user.id, user.is_active)}
                      className="text-orange-600 hover:text-orange-900"
                    >
                      {user.is_active ? '🔒 Désactiver' : '🔓 Activer'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">
                {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
              </h2>

              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-lg"
                      disabled={editingUser} // Ne pas modifier l'email
                      required
                    />
                  </div>

                  {!editingUser && (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-2">
                        Mot de passe <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="Minimum 6 caractères"
                        required={!editingUser}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Prénom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Nom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Téléphone / WhatsApp</label>
                    <input
                      type="tel"
                      name="phone_whatsapp"
                      value={formData.phone_whatsapp}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="+33612345678"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Département</label>
                    <input
                      type="text"
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="IT, RH, Commercial..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Rôle</label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="collaborator">Collaborateur</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Manager</label>
                    <select
                      name="manager_id"
                      value={formData.manager_id}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Aucun</option>
                      {managers.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.first_name} {m.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingUser ? 'Enregistrer' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default UsersManagement