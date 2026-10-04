import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useFeedback } from '../contexts/FeedbackContext'
import Alert from '@mui/material/Alert'
import api from '../api'
import {
  IconPlus, IconRefresh, IconClose, IconChevronRight, IconSearch, IconFolder,
  IconPencil, IconArchive, IconTrash, IconUserPlus, IconRedo,
} from '../components/Icons'

const STATUS = {
  active: { label: 'Actif', cls: 'bg-green-100 text-green-800 border-green-300' },
  inactive: { label: 'Inactif', cls: 'bg-red-100 text-red-800 border-red-300' },
  archived: { label: 'Archivé', cls: 'bg-gray-100 text-gray-700 border-gray-300' },
}
const ROLE_LABELS = { admin: 'Admin', manager: 'Manager', collaborator: 'Collaborateur' }

const EMPTY_FORM = { name: '', code: '', client: '', description: '', status: 'active', start_date: '', end_date: '' }

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—')
const formatLongDate = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

const ProjectsManagement = () => {
  const { token } = useAuth()
 

  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [filters, setFilters] = useState({ search: '', client: '', status: '', user: '' })
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })
  const [expandedId, setExpandedId] = useState(null)
  const [editModal, setEditModal] = useState({ open: false, project: null })
  const [assignModal, setAssignModal] = useState(null) // projet ciblé

    const { notify, confirm: ask } = useFeedback()
  const showMsg = (type, text) => notify(type, text)
  useEffect(() => {
    if (token) loadData()
  }, [token])

  // ---------- Chargement ----------
    const loadData = async () => {
    setLoading(true)
    const safe = (path) => api.list(path).catch(() => [])
    const [projectsList, usersList, assignmentsList] = await Promise.all([
      safe('/projects/all_projects/'),
      safe('/users/'),
      safe('/assignments/'),
    ])
    setProjects(projectsList)
    setUsers(usersList)
    setAssignments(assignmentsList)
    setLoading(false)
  }

  // ---------- Helpers ----------
  const userLabel = (u) => `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email
  const assignableUsers = useMemo(() => users.filter((u) => u.role !== 'admin'), [users])

  const assignmentsByProject = useMemo(() => {
    const map = new Map()
    assignments.forEach((a) => {
      if (!map.has(a.project)) map.set(a.project, [])
      map.get(a.project).push(a)
    })
    return map
  }, [assignments])

  const getAssignments = (pid) => assignmentsByProject.get(pid) || []

  // ---------- Options des filtres ----------
  const options = useMemo(() => {
    const clients = [...new Set(projects.map((p) => p.client).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    const usersSorted = [...assignableUsers].sort((a, b) => userLabel(a).localeCompare(userLabel(b)))
    return { clients, users: usersSorted }
  }, [projects, assignableUsers])

  // ---------- Filtrage + tri ----------
  const rows = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    const list = projects.filter((p) => {
      if (q && !`${p.name} ${p.code}`.toLowerCase().includes(q)) return false
      if (filters.client && p.client !== filters.client) return false
      if (filters.status && p.status !== filters.status) return false
      if (filters.user && !getAssignments(p.id).some((a) => String(a.user) === filters.user)) return false
      return true
    })

    const val = (p) => {
      switch (sort.key) {
        case 'code': return (p.code || '').toLowerCase()
        case 'client': return (p.client || '').toLowerCase()
        case 'period': return p.start_date || ''
        case 'staff': return getAssignments(p.id).length
        case 'status': return p.status || ''
        default: return (p.name || '').toLowerCase()
      }
    }
    return [...list].sort((a, b) => {
      const va = val(a), vb = val(b)
      if (va < vb) return sort.dir === 'asc' ? -1 : 1
      if (va > vb) return sort.dir === 'asc' ? 1 : -1
      return 0
    })
  }, [projects, filters, sort, assignmentsByProject])

  const counts = {
    all: projects.length,
    active: projects.filter((p) => p.status === 'active').length,
    inactive: projects.filter((p) => p.status === 'inactive').length,
    archived: projects.filter((p) => p.status === 'archived').length,
  }

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }))
  const resetFilters = () => setFilters({ search: '', client: '', status: '', user: '' })
  const hasFilters = filters.search || filters.client || filters.status || filters.user

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

 

    const handleSave = async (formData, project) => {
    const payload = {
      ...formData,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
    }
    try {
      if (project) await api.patch(`/projects/${project.id}/`, payload)
      else await api.post('/projects/', payload)
    } catch (e) {
      return e.message // affiché dans la fenêtre
    }
    setEditModal({ open: false, project: null })
    showMsg('success', project ? 'Projet modifié !' : 'Projet créé !')
    await loadData()
    return null
  }

    const handleToggleArchive = async (project) => {
    const archiving = project.status !== 'archived'
    const ok = await ask({
      title: archiving ? 'Archiver le projet' : 'Désarchiver le projet',
      message: archiving
        ? `${project.name} ne sera plus proposé pour les nouveaux CRA.\nL'historique est conservé.`
        : `${project.name} redeviendra actif : il sera de nouveau proposé aux personnes attribuées.`,
      confirmText: archiving ? 'Archiver' : 'Désarchiver',
      severity: archiving ? 'warning' : 'info',
    })
    if (!ok) return

    const newStatus = archiving ? 'archived' : 'active'
       try {
      await api.patch(`/projects/${project.id}/`, { status: newStatus })
    } catch (e) {
      return showMsg('error', e.message)
    }
    setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, status: newStatus } : p)))
    showMsg('success', archiving ? 'Projet archivé' : 'Projet désarchivé, de nouveau actif')
  }

  const handleDelete = async (project) => {
    const n = getAssignments(project.id).length

    const ok = await ask({
      title: 'Supprimer définitivement',
      message:
        `${project.name} sera supprimé, ainsi que ${n} attribution(s) et TOUS les CRA et jours déclarés sur ce projet.\n\n` +
        `Préférez « Archiver » pour conserver l'historique.`,
      confirmText: 'Supprimer',
      severity: 'error',
    })
    if (!ok) return
    if (!ok) return
        try {
      await api.delete(`/projects/${project.id}/`)
    } catch (e) {
      return showMsg('error', e.message)
    }
    setExpandedId(null)
    showMsg('success', 'Projet supprimé')
    await loadData()
  }

  // ---------- Actions attribution ----------
    const handleAssignUsers = async (project, userIds) => {
    const results = await Promise.allSettled(
      userIds.map((uid) => api.post('/assignments/', { user: uid, project: project.id }))
    )
    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length) {
      showMsg('error', `${userIds.length - failed.length} attribution(s) créée(s), ${failed.length} en erreur : ${failed[0].reason.message}`)
    } else {
      showMsg('success', `${userIds.length} personne(s) attribuée(s) à ${project.name}`)
    }
    setAssignModal(null)
    setExpandedId(project.id)
    await loadData()
  }

  const handleRemoveAssignment = async (assign, project) => {
    const u = users.find((x) => x.id === assign.user)
    const who = u ? userLabel(u) : `${assign.user_first_name} ${assign.user_last_name}`
        const ok = await ask({
      title: 'Retirer du projet',
      message: `${who} ne sera plus attribué à ${project.name}.`,
      confirmText: 'Retirer',
      severity: 'warning',
    })
    if (!ok) return
        try {
      await api.delete(`/assignments/${assign.id}/`)
    } catch (e) {
      return showMsg('error', e.message)
    }
    setAssignments((prev) => prev.filter((a) => a.id !== assign.id))
    showMsg('success', 'Attribution retirée')
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

  const statusCards = [
    { key: '', label: 'Total', count: counts.all, color: 'text-gray-900', ring: 'ring-salesforce-blue' },
    { key: 'active', label: 'Actifs', count: counts.active, color: 'text-green-600', ring: 'ring-green-500' },
    { key: 'inactive', label: 'Inactifs', count: counts.inactive, color: 'text-red-600', ring: 'ring-red-500' },
    { key: 'archived', label: 'Archivés', count: counts.archived, color: 'text-gray-600', ring: 'ring-gray-400' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Gestion des projets</h1>
          <p className="text-gray-600">Créez, modifiez et staffez vos projets</p>
        </div>
        <button
          onClick={() => setEditModal({ open: true, project: null })}
          className="px-4 py-2 bg-salesforce-blue text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <IconPlus className="w-4 h-4" />
        </button>
      </div>

     

      {/* Compteurs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statusCards.map((s) => (
          <button
            key={s.label}
            onClick={() => setFilter('status', s.key)}
            className={`bg-white rounded-lg p-4 shadow-sm border border-gray-200 text-left hover:shadow-md transition-shadow ${
              filters.status === s.key ? `ring-2 ${s.ring}` : ''
            }`}
          >
            <p className="text-sm text-gray-600 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
          </button>
        ))}
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-gray-900">Projets</h2>
              <p className="text-xs text-gray-500">{rows.length} élément{rows.length > 1 ? 's' : ''}</p>
            </div>
            <button onClick={loadData} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1.5">
              <IconRefresh className="w-4 h-4" /> Actualiser
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilter('search', e.target.value)}
                placeholder="Nom ou code..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded"
              />
            </div>

            <select value={filters.client} onChange={(e) => setFilter('client', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
              <option value="">Tous les clients</option>
              {options.clients.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
              <option value="">Tous les statuts</option>
              {Object.entries(STATUS).map(([k, s]) => (
                <option key={k} value={k}>{s.label}</option>
              ))}
            </select>

            <select value={filters.user} onChange={(e) => setFilter('user', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
              <option value="">Tous les collaborateurs</option>
              {options.users.map((u) => (
                <option key={u.id} value={u.id}>{userLabel(u)}</option>
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
                <SortHeader label="Projet" sortKey="name" />
                <SortHeader label="Code" sortKey="code" />
                <SortHeader label="Client" sortKey="client" />
                <SortHeader label="Période" sortKey="period" />
                <SortHeader label="Personnel" sortKey="staff" align="right" />
                <SortHeader label="Statut" sortKey="status" />
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-gray-500">
                    <IconFolder className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    Aucun projet ne correspond aux filtres
                  </td>
                </tr>
              )}

              {rows.map((p) => {
                const expanded = expandedId === p.id
                const staff = getAssignments(p.id)
                return (
                  <FragmentRow key={p.id}>
                    <tr className={`border-b border-gray-100 hover:bg-blue-50/40 ${expanded ? 'bg-blue-50/40' : ''}`}>
                      <td className="pl-3">
                        <button
                          onClick={() => setExpandedId(expanded ? null : p.id)}
                          className="text-gray-400 hover:text-gray-700 transition-transform"
                          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                          title="Voir le détail"
                        >
                          <IconChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedId(expanded ? null : p.id)}
                          className="font-medium text-salesforce-blue hover:underline text-left"
                        >
                          {p.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{p.code}</td>
                      <td className="px-4 py-3 text-gray-700">{p.client || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {p.start_date || p.end_date ? `${formatDate(p.start_date)} → ${formatDate(p.end_date)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {staff.length > 0 ? (
                          <span className="inline-block min-w-[28px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold text-center">
                            {staff.length}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-xs">
                            Personne
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS[p.status]?.cls || 'bg-gray-100'}`}>
                          {STATUS[p.status]?.label || p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2 whitespace-nowrap">
                          <button
                            onClick={() => setEditModal({ open: true, project: p })}
                            className="px-3 py-1 text-xs font-medium border border-gray-300 text-gray-700 rounded hover:bg-gray-50 inline-flex items-center gap-1"
                          >
                            <IconPencil className="w-3.5 h-3.5" /> Modifier
                          </button>
                                                    <button
                            onClick={() => handleToggleArchive(p)}
                            className={`px-3 py-1 text-xs font-medium border rounded inline-flex items-center gap-1 ${
                              p.status === 'archived'
                                ? 'border-green-300 text-green-700 hover:bg-green-50'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                            title={p.status === 'archived' ? 'Remettre le projet en actif' : "Archiver (conserve l'historique)"}
                          >
                            {p.status === 'archived' ? (
                              <><IconRedo className="w-3.5 h-3.5" /> Désarchiver</>
                            ) : (
                              <><IconArchive className="w-3.5 h-3.5" /> Archiver</>
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="px-3 py-1 text-xs font-medium border border-red-300 text-red-700 rounded hover:bg-red-50 inline-flex items-center gap-1"
                          >
                           <IconTrash className="w-3.5 h-3.5" /> Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expanded && (
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <td></td>
                        <td colSpan="7" className="px-4 py-4">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Détails */}
                            <div className="bg-white border border-gray-200 rounded p-4 space-y-3">
                              <p className="text-xs font-semibold uppercase text-gray-600">Détails</p>
                              <div>
                                <p className="text-xs text-gray-500">Description</p>
                                <p className="text-sm text-gray-900 whitespace-pre-line">{p.description?.trim() || '—'}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-xs text-gray-500">Début</p>
                                  <p className="text-sm text-gray-900">{formatLongDate(p.start_date)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Fin</p>
                                  <p className="text-sm text-gray-900">{formatLongDate(p.end_date)}</p>
                                </div>
                              </div>
                            </div>

                            {/* Personnel */}
                            <div className="lg:col-span-2 bg-white border border-gray-200 rounded">
                              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
                                <p className="text-xs font-semibold uppercase text-gray-600">
                                  Personnel attribué ({staff.length})
                                </p>
                                <button
                                  onClick={() => setAssignModal(p)}
                                  disabled={p.status !== 'active'}
                                  className="px-3 py-1 text-xs font-medium border border-salesforce-blue text-salesforce-blue rounded hover:bg-blue-50 disabled:opacity-35 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                  title={p.status !== 'active' ? 'Seuls les projets actifs peuvent être attribués' : ''}
                                >
                                  <IconUserPlus className="w-3.5 h-3.5" /> Attribuer
                                </button>
                              </div>
                              {staff.length === 0 ? (
                                <p className="px-4 py-6 text-sm text-gray-500 text-center">Aucune personne attribuée</p>
                              ) : (
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600">Collaborateur</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600">Email</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600">Attribué le</th>
                                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-600">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {[...staff]
                                      .sort((a, b) => new Date(b.assigned_at) - new Date(a.assigned_at))
                                      .map((a) => {
                                        const u = users.find((x) => x.id === a.user)
                                        return (
                                          <tr key={a.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 text-gray-900">
                                              {u ? userLabel(u) : `${a.user_first_name} ${a.user_last_name}`}
                                              {u?.role && (
                                                <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                                  {ROLE_LABELS[u.role]}
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-4 py-2 text-gray-600">{u?.email || a.user_email}</td>
                                            <td className="px-4 py-2 text-gray-600">{formatDate(a.assigned_at)}</td>
                                            <td className="px-4 py-2 text-right">
                                              <button
                                                onClick={() => handleRemoveAssignment(a, p)}
                                                className="px-2.5 py-0.5 text-xs font-medium border border-red-300 text-red-700 rounded hover:bg-red-50"
                                              >
                                                Retirer
                                              </button>
                                            </td>
                                          </tr>
                                        )
                                      })}
                                  </tbody>
                                </table>
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

      {/* Modal créer / modifier */}
      {editModal.open && (
        <ProjectModal
          project={editModal.project}
          onSave={handleSave}
          onClose={() => setEditModal({ open: false, project: null })}
        />
      )}

      {/* Modal attribution */}
      {assignModal && (
        <AssignUsersModal
          project={assignModal}
          users={assignableUsers}
          assignedIds={new Set(getAssignments(assignModal.id).map((a) => a.user))}
          userLabel={userLabel}
          onConfirm={handleAssignUsers}
          onClose={() => setAssignModal(null)}
        />
      )}
    </div>
  )
}

const FragmentRow = ({ children }) => <>{children}</>

// ---------- Modal créer / modifier ----------
const ProjectModal = ({ project, onSave, onClose }) => {
  const [form, setForm] = useState(
    project
      ? {
          name: project.name || '',
          code: project.code || '',
          client: project.client || '',
          description: project.description || '',
          status: project.status || 'active',
          start_date: project.start_date || '',
          end_date: project.end_date || '',
        }
      : EMPTY_FORM
  )
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.name.trim() || !form.code.trim()) return setError('Le nom et le code sont obligatoires')
    if (form.start_date && form.end_date && form.start_date > form.end_date)
      return setError('La date de fin doit être après la date de début')
    setSaving(true)
    const err = await onSave(form, project)
    setSaving(false)
    if (err) setError(err)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{project ? 'Modifier le projet' : 'Nouveau projet'}</h2>
          {project && <p className="text-sm text-gray-600 mt-1">{project.name} ({project.code})</p>}
        </div>

        <form onSubmit={submit}>
          <div className="p-6">
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Nom <span className="text-red-500">*</span></label>
                <input name="name" value={form.name} onChange={change} className="w-full px-3 py-2 border rounded-lg" placeholder="Migration Cloud AWS" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Code <span className="text-red-500">*</span></label>
                <input name="code" value={form.code} onChange={change} className="w-full px-3 py-2 border rounded-lg" placeholder="CLOUD-2026" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Client</label>
                <input name="client" value={form.client} onChange={change} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Statut</label>
                <select name="status" value={form.status} onChange={change} className="w-full px-3 py-2 border rounded-lg">
                  {Object.entries(STATUS).map(([k, s]) => (
                    <option key={k} value={k}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div />
              <div>
                <label className="block text-sm font-medium mb-1">Date de début</label>
                <input type="date" name="start_date" value={form.start_date} onChange={change} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date de fin</label>
                <input type="date" name="end_date" value={form.end_date} onChange={change} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea name="description" value={form.description} onChange={change} rows={3} className="w-full px-3 py-2 border rounded-lg" />
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
              {saving ? 'Enregistrement...' : project ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------- Modal attribuer des personnes ----------
const AssignUsersModal = ({ project, users, assignedIds, userLabel, onConfirm, onClose }) => {
  const [selected, setSelected] = useState([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const toggle = (uid) => setSelected((s) => (s.includes(uid) ? s.filter((x) => x !== uid) : [...s, uid]))

  const list = [...users]
    .filter((u) => `${userLabel(u)} ${u.email}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => userLabel(a).localeCompare(userLabel(b)))

  const submit = async () => {
    setSaving(true)
    await onConfirm(project, selected)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Attribuer des personnes</h2>
          <p className="text-sm text-gray-600 mt-1">{project.name} ({project.code})</p>
        </div>

        <div className="p-6 space-y-3">
                    <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un nom ou un email..."
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg"
            />
          </div>
          <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {list.length === 0 && <p className="p-3 text-sm text-gray-500">Aucun résultat</p>}
            {list.map((u) => {
              const already = assignedIds.has(u.id)
              return (
                <label
                  key={u.id}
                  className={`flex items-center gap-3 px-3 py-2 text-sm ${already ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}`}
                >
                  <input
                    type="checkbox"
                    checked={already || selected.includes(u.id)}
                    disabled={already}
                    onChange={() => toggle(u.id)}
                  />
                  <span className="flex-1">
                    {userLabel(u)} <span className="text-gray-400">— {u.email}</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                    {already ? 'déjà attribué' : ROLE_LABELS[u.role]}
                  </span>
                </label>
              )
            })}
          </div>
          {selected.length > 0 && <p className="text-xs text-salesforce-blue">{selected.length} personne(s) sélectionnée(s)</p>}
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Annuler</button>
          <button
            onClick={submit}
            disabled={selected.length === 0 || saving}
            className="px-4 py-2 bg-salesforce-blue text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Attribution...' : `Attribuer${selected.length ? ` (${selected.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProjectsManagement