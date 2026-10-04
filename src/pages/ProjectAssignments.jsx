import { useState, useEffect, useMemo } from 'react'
import { useFeedback } from '../contexts/FeedbackContext'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import { IconPlus, IconRefresh, IconClose, IconChevronRight, IconUsers } from '../components/Icons'
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const ROLE_LABELS = { admin: 'Admin', manager: 'Manager', collaborator: 'Collaborateur' }

const monthKey = (d) => {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}
const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
const formatDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—')

const ProjectAssignments = () => {
  const { token } = useAuth()
  

  const [assignments, setAssignments] = useState([])
  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
 
  const [filters, setFilters] = useState({ period: '', user: '', project: '' })
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })
  const [expandedId, setExpandedId] = useState(null)
  const [modal, setModal] = useState({ open: false, userId: '' })

   const { notify, confirm: ask } = useFeedback()
  const showMsg = (type, text) => notify(type, text)

  useEffect(() => {
    if (token) loadData()
  }, [token])

  // ---------- Chargement ----------
    const loadData = async () => {
    setLoading(true)
    const safe = (path) => api.list(path).catch(() => [])
    const [assignmentsList, usersList, projectsList] = await Promise.all([
      safe('/assignments/'),
      safe('/users/'),
      safe('/projects/'),
    ])
    setAssignments(assignmentsList)
    setUsers(usersList)
    setProjects(projectsList)
    setLoading(false)
  }

  // ---------- Helpers ----------
  const assignableUsers = useMemo(() => users.filter((u) => u.role !== 'admin'), [users])

  const userLabel = (u) => `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email

  const projectInfo = (a) => {
    const p = projects.find((x) => x.id === a.project)
    return {
      name: a.project_name || p?.name || 'N/A',
      code: a.project_code || p?.code || '',
    }
  }

  // ---------- Options des filtres ----------
  const options = useMemo(() => {
    const periods = [...new Set(assignments.map((a) => monthKey(a.assigned_at)))].sort().reverse()
    const projMap = new Map()
    assignments.forEach((a) => {
      const info = projectInfo(a)
      projMap.set(String(a.project), `${info.name}${info.code ? ` (${info.code})` : ''}`)
    })
    return {
      periods,
      users: [...assignableUsers].sort((a, b) => userLabel(a).localeCompare(userLabel(b))),
      projects: [...projMap.entries()].sort((a, b) => a[1].localeCompare(b[1])),
    }
  }, [assignments, assignableUsers, projects])

  // ---------- Regroupement par collaborateur ----------
  const groups = useMemo(() => {
    const filtered = assignments.filter(
      (a) =>
        (!filters.period || monthKey(a.assigned_at) === filters.period) &&
        (!filters.project || String(a.project) === filters.project) &&
        (!filters.user || String(a.user) === filters.user)
    )

    const map = new Map()

    // Collaborateurs sans projet : visibles seulement sans filtre mois/projet
    if (!filters.period && !filters.project) {
      assignableUsers
        .filter((u) => !filters.user || String(u.id) === filters.user)
        .forEach((u) => map.set(u.id, { user: u, items: [] }))
    }

    filtered.forEach((a) => {
      if (!map.has(a.user)) {
        const u = users.find((x) => x.id === a.user) || {
          id: a.user,
          first_name: a.user_first_name,
          last_name: a.user_last_name,
          email: a.user_email,
        }
        map.set(a.user, { user: u, items: [] })
      }
      map.get(a.user).items.push(a)
    })

    const list = [...map.values()].map((g) => ({
      ...g,
      items: [...g.items].sort((a, b) => new Date(b.assigned_at) - new Date(a.assigned_at)),
      count: g.items.length,
      last: g.items.reduce((max, a) => (!max || new Date(a.assigned_at) > new Date(max) ? a.assigned_at : max), null),
    }))

    const val = (g) => {
      switch (sort.key) {
        case 'email': return (g.user.email || '').toLowerCase()
        case 'role': return g.user.role || ''
        case 'count': return g.count
        case 'last': return g.last ? new Date(g.last).getTime() : 0
        default: return userLabel(g.user).toLowerCase()
      }
    }
    return list.sort((a, b) => {
      const va = val(a), vb = val(b)
      if (va < vb) return sort.dir === 'asc' ? -1 : 1
      if (va > vb) return sort.dir === 'asc' ? 1 : -1
      return 0
    })
  }, [assignments, users, assignableUsers, filters, sort])

  const totalAssignments = groups.reduce((s, g) => s + g.count, 0)

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }))
  const resetFilters = () => setFilters({ period: '', user: '', project: '' })
  const hasFilters = filters.period || filters.user || filters.project

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  // ---------- Actions ----------
    const handleAssign = async (userId, projectIds) => {
    const results = await Promise.allSettled(
      projectIds.map((pid) => api.post('/assignments/', { user: parseInt(userId), project: pid }))
    )
    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length) {
      showMsg('error', `${projectIds.length - failed.length} attribution(s) créée(s), ${failed.length} en erreur : ${failed[0].reason.message}`)
    } else {
      showMsg('success', `${projectIds.length} projet(s) attribué(s) !`)
    }
    setModal({ open: false, userId: '' })
    setExpandedId(parseInt(userId))
    await loadData()
  }

  const handleDelete = async (assign, user) => {
    const info = projectInfo(assign)
        const ok = await ask({
      title: 'Retirer le projet',
      message: `${userLabel(user)} ne sera plus attribué à ${info.name}.`,
      confirmText: 'Retirer',
      severity: 'warning',
    })
    if (!ok) return
    try {
           await api.delete(`/assignments/${assign.id}/`)
      setAssignments((prev) => prev.filter((a) => a.id !== assign.id))
      showMsg('success', 'Attribution retirée')
    } catch (error) {
      showMsg('error', error.message)
    }
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

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Attribution des projets</h1>
          <p className="text-gray-600">Gérez les projets attribués à chaque collaborateur</p>
        </div>
        <button
          onClick={() => setModal({ open: true, userId: '' })}
          className="px-4 py-2 bg-salesforce-blue text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <IconPlus className="w-4 h-4" />
        </button>
      </div>

     

      {/* Tableau */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Titre + filtres */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-gray-900">Collaborateurs</h2>
              <p className="text-xs text-gray-500">
                {groups.length} collaborateur{groups.length > 1 ? 's' : ''} · {totalAssignments} attribution{totalAssignments > 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={loadData} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1.5">
              <IconRefresh className="w-4 h-4" /> Actualiser
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select value={filters.period} onChange={(e) => setFilter('period', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
              <option value="">Toutes les dates</option>
              {options.periods.map((p) => (
                <option key={p} value={p}>Attribué en {monthLabel(p)}</option>
              ))}
            </select>

            <select value={filters.user} onChange={(e) => setFilter('user', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
              <option value="">Tous les collaborateurs</option>
              {options.users.map((u) => (
                <option key={u.id} value={u.id}>{userLabel(u)}</option>
              ))}
            </select>

            <select value={filters.project} onChange={(e) => setFilter('project', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
              <option value="">Tous les projets</option>
              {options.projects.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
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
                <SortHeader label="Collaborateur" sortKey="name" />
                <SortHeader label="Email" sortKey="email" />
                <SortHeader label="Rôle" sortKey="role" />
                <SortHeader label="Projets" sortKey="count" align="right" />
                <SortHeader label="Dernière attribution" sortKey="last" />
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-gray-500">
                    <IconUsers className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    Aucune attribution ne correspond aux filtres
                  </td>
                </tr>
              )}

              {groups.map((g) => {
                const expanded = expandedId === g.user.id
                return (
                  <FragmentRow key={g.user.id}>
                    <tr className={`border-b border-gray-100 hover:bg-blue-50/40 ${expanded ? 'bg-blue-50/40' : ''}`}>
                      <td className="pl-3">
                        <button
                          onClick={() => setExpandedId(expanded ? null : g.user.id)}
                          disabled={g.count === 0}
                          className="text-gray-400 hover:text-gray-700 transition-transform disabled:opacity-30"
                          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                          title="Voir les projets"
                        >
                          <IconChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => g.count > 0 && setExpandedId(expanded ? null : g.user.id)}
                          className="font-medium text-salesforce-blue hover:underline text-left"
                        >
                          {userLabel(g.user)}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{g.user.email}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">
                          {ROLE_LABELS[g.user.role] || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {g.count > 0 ? (
                          <span className="inline-block min-w-[28px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold text-center">
                            {g.count}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-xs">
                            Aucun projet
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDate(g.last)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setModal({ open: true, userId: String(g.user.id) })}
                          className="px-3 py-1 text-xs font-medium border border-salesforce-blue text-salesforce-blue rounded hover:bg-blue-50 inline-flex items-center gap-1"
                        >
                          <IconPlus className="w-3.5 h-3.5" /> Attribuer
                        </button>
                      </td>
                    </tr>

                    {expanded && g.count > 0 && (
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <td></td>
                        <td colSpan="6" className="px-4 py-3">
                          <table className="w-full text-sm bg-white border border-gray-200 rounded">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">Projet</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">Code</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">Attribué le</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-600">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {g.items.map((a) => {
                                const info = projectInfo(a)
                                return (
                                  <tr key={a.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 text-gray-900">{info.name}</td>
                                    <td className="px-3 py-2 text-gray-600">{info.code}</td>
                                    <td className="px-3 py-2 text-gray-600">{formatDate(a.assigned_at)}</td>
                                    <td className="px-3 py-2 text-right">
                                      <button
                                        onClick={() => handleDelete(a, g.user)}
                                        className="px-2.5 py-0.5 text-xs font-medium border border-red-300 text-red-700 rounded hover:bg-red-50 inline-flex items-center gap-1"
                                      >
                                        <IconClose className="w-3.5 h-3.5" /> Retirer
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
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

      {/* Modal attribution */}
      {modal.open && (
        <AssignModal
          users={assignableUsers}
          projects={projects.filter((p) => p.status === 'active')}
          assignments={assignments}
          initialUserId={modal.userId}
          userLabel={userLabel}
          onConfirm={handleAssign}
          onClose={() => setModal({ open: false, userId: '' })}
        />
      )}
    </div>
  )
}

const FragmentRow = ({ children }) => <>{children}</>

// ---------- Modal : attribuer un ou plusieurs projets ----------
const AssignModal = ({ users, projects, assignments, initialUserId, userLabel, onConfirm, onClose }) => {
  const [userId, setUserId] = useState(initialUserId || '')
  const [selected, setSelected] = useState([])
  const [saving, setSaving] = useState(false)

  const assignedIds = new Set(
    assignments.filter((a) => String(a.user) === String(userId)).map((a) => a.project)
  )

  const toggle = (pid) =>
    setSelected((s) => (s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid]))

  const handleUserChange = (value) => {
    setUserId(value)
    setSelected([])
  }

  const submit = async () => {
    setSaving(true)
    await onConfirm(userId, selected)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Attribuer des projets</h2>
          <p className="text-sm text-gray-600 mt-1">Cochez un ou plusieurs projets actifs</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Collaborateur <span className="text-red-500">*</span>
            </label>
            <select
              value={userId}
              onChange={(e) => handleUserChange(e.target.value)}
              disabled={!!initialUserId}
              className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-50"
            >
              <option value="">Sélectionner...</option>
              {[...users]
                .sort((a, b) => userLabel(a).localeCompare(userLabel(b)))
                .map((u) => (
                  <option key={u.id} value={u.id}>{userLabel(u)} — {u.email}</option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Projets <span className="text-red-500">*</span>
              {selected.length > 0 && <span className="ml-2 text-xs text-salesforce-blue">{selected.length} sélectionné(s)</span>}
            </label>
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {projects.length === 0 && <p className="p-3 text-sm text-gray-500">Aucun projet actif</p>}
              {projects.map((p) => {
                const already = assignedIds.has(p.id)
                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 px-3 py-2 text-sm ${
                      already || !userId ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={already || selected.includes(p.id)}
                      disabled={already || !userId}
                      onChange={() => toggle(p.id)}
                    />
                    <span className="flex-1">
                      {p.name} <span className="text-gray-400">({p.code})</span>
                    </span>
                    {already && <span className="text-xs text-gray-400">déjà attribué</span>}
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Annuler</button>
          <button
            onClick={submit}
            disabled={!userId || selected.length === 0 || saving}
            className="px-4 py-2 bg-salesforce-blue text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Attribution...' : `Attribuer${selected.length ? ` (${selected.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProjectAssignments