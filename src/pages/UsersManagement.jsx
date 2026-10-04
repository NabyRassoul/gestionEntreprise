import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Alert from '@mui/material/Alert'
import api from '../api'
import { useFeedback } from '../contexts/FeedbackContext'
import {
  IconPlus, IconRefresh, IconClose, IconChevronRight, IconSearch, IconUsers,
  IconPencil, IconNoSymbol, IconCheck, IconTrash,
} from '../components/Icons'
const ROLES = {
  admin: { label: 'Admin', cls: 'bg-red-100 text-red-800 border-red-300' },
  manager: { label: 'Manager', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  collaborator: { label: 'Collaborateur', cls: 'bg-green-100 text-green-800 border-green-300' },
}

const EMPTY_FORM = { email: '', first_name: '', last_name: '', role: 'collaborator', department: '', manager: '', password: '' }

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—')

const UsersManagement = () => {
  const { token, user: me } = useAuth()
  

  const [users, setUsers] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
 
  const [filters, setFilters] = useState({ search: '', role: '', department: '', manager: '', active: '' })
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })
  const [expandedId, setExpandedId] = useState(null)
  const [modal, setModal] = useState({ open: false, user: null })

    const { notify, confirm: ask } = useFeedback()
  const showMsg = (type, text) => notify(type, text)

  useEffect(() => {
    if (token) loadData()
  }, [token])

  // ---------- Chargement ----------
    const loadData = async () => {
    setLoading(true)
    const safe = (path) => api.list(path).catch(() => [])
    const [usersList, assignmentsList] = await Promise.all([safe('/users/'), safe('/assignments/')])
    setUsers(usersList)
    setAssignments(assignmentsList)
    setLoading(false)
  }

  // ---------- Helpers ----------
  const userLabel = (u) => (u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email : '—')
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])

  // Managers possibles = rôle manager (actifs), triés
  const managers = useMemo(
    () => users.filter((u) => u.role === 'manager' && u.is_active !== false).sort((a, b) => userLabel(a).localeCompare(userLabel(b))),
    [users]
  )

  const assignmentsByUser = useMemo(() => {
    const map = new Map()
    assignments.forEach((a) => {
      if (!map.has(a.user)) map.set(a.user, [])
      map.get(a.user).push(a)
    })
    return map
  }, [assignments])

  const getAssignments = (uid) => assignmentsByUser.get(uid) || []
  const getTeam = (uid) => users.filter((u) => u.manager === uid)

  // ---------- Options des filtres ----------
  const departments = useMemo(
    () => [...new Set(users.map((u) => u.department).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [users]
  )

  // ---------- Filtrage + tri ----------
  const rows = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    const list = users.filter((u) => {
      if (q && !`${userLabel(u)} ${u.email}`.toLowerCase().includes(q)) return false
      if (filters.role && u.role !== filters.role) return false
      if (filters.department && u.department !== filters.department) return false
      if (filters.manager === 'none' && u.manager) return false
      if (filters.manager && filters.manager !== 'none' && String(u.manager) !== filters.manager) return false
      if (filters.active === 'active' && u.is_active === false) return false
      if (filters.active === 'inactive' && u.is_active !== false) return false
      return true
    })

    const val = (u) => {
      switch (sort.key) {
        case 'email': return (u.email || '').toLowerCase()
        case 'role': return u.role || ''
        case 'department': return (u.department || '').toLowerCase()
        case 'manager': return userLabel(userById.get(u.manager)).toLowerCase()
        case 'projects': return getAssignments(u.id).length
        case 'active': return u.is_active === false ? 1 : 0
        default: return userLabel(u).toLowerCase()
      }
    }
    return [...list].sort((a, b) => {
      const va = val(a), vb = val(b)
      if (va < vb) return sort.dir === 'asc' ? -1 : 1
      if (va > vb) return sort.dir === 'asc' ? 1 : -1
      return 0
    })
  }, [users, filters, sort, assignmentsByUser, userById])

  const counts = {
    all: users.length,
    collaborator: users.filter((u) => u.role === 'collaborator').length,
    manager: users.filter((u) => u.role === 'manager').length,
    admin: users.filter((u) => u.role === 'admin').length,
  }

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }))
  const resetFilters = () => setFilters({ search: '', role: '', department: '', manager: '', active: '' })
  const hasFilters = Object.values(filters).some(Boolean)

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  

  const handleSave = async (form, user) => {
    const payload = { ...form, manager: form.manager ? parseInt(form.manager) : null }
    if (user && !payload.password) delete payload.password

        try {
      if (user) await api.patch(`/users/${user.id}/`, payload)
      else await api.post('/users/', payload)
    } catch (e) {
      return e.message // affiché dans la fenêtre
    }
    setModal({ open: false, user: null })
    showMsg('success', user ? 'Utilisateur modifié !' : 'Utilisateur créé !')
    await loadData()
    return null
  }

  const handleToggleActive = async (u) => {
    const activate = u.is_active === false
        const ok = await ask({
      title: activate ? 'Réactiver le compte' : 'Désactiver le compte',
      message: activate
        ? `${userLabel(u)} pourra de nouveau se connecter.`
        : `${userLabel(u)} ne pourra plus se connecter.\nSon historique est conservé.`,
      confirmText: activate ? 'Réactiver' : 'Désactiver',
      severity: activate ? 'info' : 'warning',
    })
    if (!ok) return
        try {
      await api.patch(`/users/${u.id}/`, { is_active: activate })
    } catch (e) {
      return showMsg('error', e.message)
    }
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_active: activate } : x)))
    showMsg('success', `${userLabel(u)} ${activate ? 'réactivé' : 'désactivé'}`)
  }

  const handleDelete = async (u) => {
    const nProj = getAssignments(u.id).length
    const nTeam = getTeam(u.id).length
       const ok = await ask({
      title: 'Supprimer définitivement',
      message:
        `${userLabel(u)} sera supprimé, ainsi que ses ${nProj} attribution(s) et TOUS ses CRA.` +
        (nTeam ? `\n${nTeam} personne(s) n'auront plus de manager.` : '') +
        `\n\nPréférez « Désactiver » pour conserver l'historique.`,
      confirmText: 'Supprimer',
      severity: 'error',
    })
    if (!ok) return
       try {
      await api.delete(`/users/${u.id}/`)
    } catch (e) {
      return showMsg('error', e.message)
    }
    setExpandedId(null)
    showMsg('success', 'Utilisateur supprimé')
    await loadData()
  }

  // ---------- Rendu ----------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Chargement...</div>
      </div>
    )
  }

  const SortHeader = ({ label, sortKey, align = 'left' }) => (
    <th className={`px-4 py-2.5 text-${align}`}>
      <button
        onClick={() => toggleSort(sortKey)}
        className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600 hover:text-gray-900 ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        {label}
        <span className={`text-[10px] ${sort.key === sortKey ? 'text-salesforce-blue' : 'text-gray-300'}`}>
          {sort.key === sortKey && sort.dir === 'asc' ? '▲' : '▼'}
        </span>
      </button>
    </th>
  )

  const roleCards = [
    { key: '', label: 'Total', count: counts.all, color: 'text-gray-900', ring: 'ring-salesforce-blue' },
    { key: 'collaborator', label: 'Collaborateurs', count: counts.collaborator, color: 'text-green-600', ring: 'ring-green-500' },
    { key: 'manager', label: 'Managers', count: counts.manager, color: 'text-blue-600', ring: 'ring-blue-500' },
    { key: 'admin', label: 'Admins', count: counts.admin, color: 'text-red-600', ring: 'ring-red-500' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Gestion des utilisateurs</h1>
          <p className="text-gray-600">Comptes, rôles et rattachements managériaux</p>
        </div>
        <button
          onClick={() => setModal({ open: true, user: null })}
          className="px-4 py-2 bg-salesforce-blue text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <IconPlus className="w-4 h-4" />
        </button>
      </div>

      

      {/* Compteurs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {roleCards.map((c) => (
          <button
            key={c.label}
            onClick={() => setFilter('role', c.key)}
            className={`bg-white rounded-lg p-4 shadow-sm border border-gray-200 text-left hover:shadow-md transition-shadow ${
              filters.role === c.key ? `ring-2 ${c.ring}` : ''
            }`}
          >
            <p className="text-sm text-gray-600 mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.count}</p>
          </button>
        ))}
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-gray-900">Utilisateurs</h2>
              <p className="text-xs text-gray-500">{rows.length} élément{rows.length > 1 ? 's' : ''}</p>
            </div>
            <button onClick={loadData} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1.5">
              <IconRefresh className="w-4 h-4" /> Actualiser
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                        <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilter('search', e.target.value)}
                placeholder="Nom ou email..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded"
              />
            </div>

            <select value={filters.role} onChange={(e) => setFilter('role', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
              <option value="">Tous les rôles</option>
              {Object.entries(ROLES).map(([k, r]) => (
                <option key={k} value={k}>{r.label}</option>
              ))}
            </select>

            <select value={filters.department} onChange={(e) => setFilter('department', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
              <option value="">Tous les départements</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select value={filters.manager} onChange={(e) => setFilter('manager', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
              <option value="">Tous les managers</option>
              <option value="none">— Sans manager —</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{userLabel(m)}</option>
              ))}
            </select>

            <select value={filters.active} onChange={(e) => setFilter('active', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
              <option value="">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="inactive">Inactifs</option>
            </select>

            <button
              onClick={resetFilters}
              disabled={!hasFilters}
              className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
             <IconClose className="w-4 h-4" /> Réinitialiser
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-8"></th>
                <SortHeader label="Nom" sortKey="name" />
                <SortHeader label="Email" sortKey="email" />
                <SortHeader label="Rôle" sortKey="role" />
                <SortHeader label="Département" sortKey="department" />
                <SortHeader label="Manager" sortKey="manager" />
                <SortHeader label="Projets" sortKey="projects" align="right" />
                <SortHeader label="Statut" sortKey="active" />
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-4 py-12 text-center text-gray-500">
                    <IconUsers className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    Aucun utilisateur ne correspond aux filtres
                  </td>
                </tr>
              )}

              {rows.map((u) => {
                const expanded = expandedId === u.id
                const isMe = u.id === me?.id
                const inactive = u.is_active === false
                const projects = getAssignments(u.id)
                const team = getTeam(u.id)
                const manager = userById.get(u.manager)

                return (
                  <FragmentRow key={u.id}>
                    <tr className={`border-b border-gray-100 hover:bg-blue-50/40 ${expanded ? 'bg-blue-50/40' : ''} ${inactive ? 'opacity-60' : ''}`}>
                      <td className="pl-3">
                        <button
                          onClick={() => setExpandedId(expanded ? null : u.id)}
                          className="text-gray-400 hover:text-gray-700 transition-transform"
                          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                          title="Voir le détail"
                        >
                         <IconChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedId(expanded ? null : u.id)}
                          className="font-medium text-salesforce-blue hover:underline text-left"
                        >
                          {userLabel(u)}
                        </button>
                        {isMe && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">vous</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${ROLES[u.role]?.cls || 'bg-gray-100'}`}>
                          {ROLES[u.role]?.label || u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{u.department || '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{manager ? userLabel(manager) : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {u.role === 'admin' ? (
                          <span className="text-gray-400">—</span>
                        ) : projects.length > 0 ? (
                          <span className="inline-block min-w-[28px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold text-center">
                            {projects.length}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-xs">
                            Aucun
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          inactive ? 'bg-gray-100 text-gray-600 border-gray-300' : 'bg-green-50 text-green-700 border-green-300'
                        }`}>
                          {inactive ? 'Inactif' : 'Actif'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2 whitespace-nowrap">
                          <button
                            onClick={() => setModal({ open: true, user: u })}
                            className="px-3 py-1 text-xs font-medium border border-gray-300 text-gray-700 rounded hover:bg-gray-50 inline-flex items-center gap-1"
                          >
                            <IconPencil className="w-3.5 h-3.5" /> Modifier
                          </button>
                          <button
                            onClick={() => handleToggleActive(u)}
                            disabled={isMe}
                            title={isMe ? 'Impossible sur votre propre compte' : ''}
                            className="px-3 py-1 text-xs font-medium border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-35 disabled:cursor-not-allowed"
                          >
                            {inactive ? <><IconCheck className="w-3.5 h-3.5" /> Réactiver</> : <><IconNoSymbol className="w-3.5 h-3.5" /> Désactiver</>}
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            disabled={isMe}
                            title={isMe ? 'Impossible sur votre propre compte' : ''}
                            className="px-3 py-1 text-xs font-medium border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-35 disabled:cursor-not-allowed inline-flex items-center gap-1"
                          >
                            <IconTrash className="w-3.5 h-3.5" /> Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expanded && (
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <td></td>
                        <td colSpan="8" className="px-4 py-4">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Infos */}
                            <div className="bg-white border border-gray-200 rounded p-4 space-y-3">
                              <p className="text-xs font-semibold uppercase text-gray-600">Informations</p>
                              <div>
                                <p className="text-xs text-gray-500">Manager</p>
                                <p className="text-sm text-gray-900">{manager ? `${userLabel(manager)} — ${manager.email}` : '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Département</p>
                                <p className="text-sm text-gray-900">{u.department || '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Créé le</p>
                                <p className="text-sm text-gray-900">{formatDate(u.created_at)}</p>
                              </div>
                            </div>

                            {/* Projets */}
                            <div className="bg-white border border-gray-200 rounded">
                              <p className="px-4 py-2.5 border-b border-gray-200 text-xs font-semibold uppercase text-gray-600">
                                Projets attribués ({projects.length})
                              </p>
                              {projects.length === 0 ? (
                                <p className="px-4 py-6 text-sm text-gray-500 text-center">Aucun projet</p>
                              ) : (
                                <ul className="divide-y divide-gray-100">
                                  {[...projects]
                                    .sort((a, b) => new Date(b.assigned_at) - new Date(a.assigned_at))
                                    .map((a) => (
                                      <li key={a.id} className="px-4 py-2 flex justify-between text-sm">
                                        <span className="text-gray-900">
                                          {a.project_name} <span className="text-gray-400">({a.project_code})</span>
                                        </span>
                                        <span className="text-gray-500">{formatDate(a.assigned_at)}</span>
                                      </li>
                                    ))}
                                </ul>
                              )}
                            </div>

                            {/* Équipe */}
                            <div className="bg-white border border-gray-200 rounded">
                              <p className="px-4 py-2.5 border-b border-gray-200 text-xs font-semibold uppercase text-gray-600">
                                Équipe ({team.length})
                              </p>
                              {team.length === 0 ? (
                                <p className="px-4 py-6 text-sm text-gray-500 text-center">
                                  {u.role === 'manager' ? 'Aucun collaborateur rattaché' : 'Non applicable'}
                                </p>
                              ) : (
                                <ul className="divide-y divide-gray-100">
                                  {team.map((t) => (
                                    <li key={t.id} className="px-4 py-2 flex justify-between text-sm">
                                      <span className="text-gray-900">{userLabel(t)}</span>
                                      <span className="text-gray-500">{t.email}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </FragmentRow>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal.open && (
        <UserModal
          user={modal.user}
          managers={managers}
          userLabel={userLabel}
          onSave={handleSave}
          onClose={() => setModal({ open: false, user: null })}
        />
      )}
    </div>
  )
}

const FragmentRow = ({ children }) => <>{children}</>

// ---------- Modal créer / modifier ----------
const UserModal = ({ user, managers, userLabel, onSave, onClose }) => {
  const [form, setForm] = useState(
    user
      ? {
          email: user.email || '',
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          role: user.role || 'collaborator',
          department: user.department || '',
          manager: user.manager ? String(user.manager) : '',
          password: '',
        }
      : EMPTY_FORM
  )
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  // Un utilisateur ne peut pas être son propre manager
  const managerOptions = managers.filter((m) => !user || m.id !== user.id)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.email.trim() || !form.first_name.trim() || !form.last_name.trim())
      return setError('Email, prénom et nom sont obligatoires')
    if (!user && !form.password) return setError('Le mot de passe est obligatoire pour un nouveau compte')
    if (form.password && form.password.length < 8) return setError('Le mot de passe doit faire au moins 8 caractères')
    setSaving(true)
    const err = await onSave(form, user)
    setSaving(false)
    if (err) setError(err)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{user ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}</h2>
          {user && <p className="text-sm text-gray-600 mt-1">{userLabel(user)} — {user.email}</p>}
        </div>

        <form onSubmit={submit}>
          <div className="p-6">
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Prénom <span className="text-red-500">*</span></label>
                <input name="first_name" value={form.first_name} onChange={change} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nom <span className="text-red-500">*</span></label>
                <input name="last_name" value={form.last_name} onChange={change} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email <span className="text-red-500">*</span></label>
                <input type="email" name="email" value={form.email} onChange={change} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Mot de passe {!user && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={change}
                  autoComplete="new-password"
                  placeholder={user ? 'Laisser vide pour ne pas changer' : '8 caractères minimum'}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rôle</label>
                <select name="role" value={form.role} onChange={change} className="w-full px-3 py-2 border rounded-lg">
                  {Object.entries(ROLES).map(([k, r]) => (
                    <option key={k} value={k}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Département</label>
                <input name="department" value={form.department} onChange={change} className="w-full px-3 py-2 border rounded-lg" placeholder="IT, Ventes..." />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Manager</label>
                <select name="manager" value={form.manager} onChange={change} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Aucun</option>
                  {managerOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {userLabel(m)} — {m.email}{m.department ? ` (${m.department})` : ''}
                    </option>
                  ))}
                </select>
                                {managerOptions.length === 0 && (
                  <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
                    Aucun manager actif. Créez d'abord un utilisateur avec le rôle Manager.
                  </Alert>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Annuler</button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-salesforce-blue text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : user ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default UsersManagement