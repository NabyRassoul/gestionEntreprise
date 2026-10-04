import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Alert from '@mui/material/Alert'
import api from '../api'
import AlertTitle from '@mui/material/AlertTitle'
import { useFeedback } from '../contexts/FeedbackContext'
import {
  IconRefresh, IconClose, IconClipboard, IconChevronRight, IconCheck, IconX, IconLeave, IconPending,IconDownload,
} from '../components/Icons'

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

const STATUS = {
  submitted: { label: 'En attente', cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  validated: { label: 'Validé', cls: 'bg-green-100 text-green-800 border-green-300' },
  rejected: { label: 'Rejeté', cls: 'bg-red-100 text-red-800 border-red-300' },
}

const periodKey = (c) => `${c.year}-${String(c.month).padStart(2, '0')}`
const periodLabel = (key) => {
  const [y, m] = key.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
const formatDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—')

const ValidationCRA = () => {
  const { user, token } = useAuth()
  

  const [cras, setCras] = useState([])
  const [loading, setLoading] = useState(true)
 
  const [filters, setFilters] = useState({ period: '', user: '', project: '', status: 'all' })
  const [sort, setSort] = useState({ key: 'submitted_at', dir: 'desc' })
  const [expandedId, setExpandedId] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [leaves, setLeaves] = useState([])

    const { notify, confirm: ask } = useFeedback()
  const showMsg = (type, text) => notify(type, text)
  useEffect(() => {
    if (token) loadCRAs()
  }, [token])

  // ---------- Chargement ----------
   const loadCRAs = async () => {
    setLoading(true)
    try {
          const [list, leavesList] = await Promise.all([
        api.list('/cra-submissions/', { include: 'entries' }),
        api.list('/leaves/').catch(() => []),
      ])
      setCras(
        list
          .filter((c) => ['submitted', 'validated', 'rejected'].includes(c.status))
          .map((c) => ({ ...c, totalDays: c.total_days }))
      )
     setLeaves(leavesList.filter((l) => l.leave_type !== 'tt'))
    } catch (e) {
      showMsg('error', `Erreur lors du chargement des CRA : ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ---------- Options des filtres ----------
  const options = useMemo(() => {
    const periods = [...new Set(cras.map(periodKey))].sort().reverse()
    const users = new Map()
    const projects = new Map()
    cras.forEach((c) => {
      users.set(String(c.user), c.user_name?.trim() || c.user_email)
      if (c.project) projects.set(String(c.project), `${c.project_name} (${c.project_code})`)
    })
    const byLabel = (a, b) => a[1].localeCompare(b[1])
    return {
      periods,
      users: [...users.entries()].sort(byLabel),
      projects: [...projects.entries()].sort(byLabel),
    }
  }, [cras])

  // ---------- Filtrage (hors statut → pour les compteurs) ----------
  const baseFiltered = useMemo(
    () =>
      cras.filter(
        (c) =>
          (!filters.period || periodKey(c) === filters.period) &&
          (!filters.user || String(c.user) === filters.user) &&
          (!filters.project || String(c.project) === filters.project)
      ),
    [cras, filters.period, filters.user, filters.project]
  )

  const counts = {
    all: baseFiltered.length,
    submitted: baseFiltered.filter((c) => c.status === 'submitted').length,
    validated: baseFiltered.filter((c) => c.status === 'validated').length,
    rejected: baseFiltered.filter((c) => c.status === 'rejected').length,
  }

  // ---------- Filtrage statut + tri ----------
  const rows = useMemo(() => {
    const list = baseFiltered.filter((c) => filters.status === 'all' || c.status === filters.status)
    const val = (c) => {
      switch (sort.key) {
        case 'user': return (c.user_name || c.user_email || '').toLowerCase()
        case 'project': return (c.project_name || '').toLowerCase()
        case 'period': return c.year * 100 + c.month
        case 'days': return c.totalDays
        case 'status': return c.status
        default: return c.submitted_at ? new Date(c.submitted_at).getTime() : 0
      }
    }
    return [...list].sort((a, b) => {
      const va = val(a), vb = val(b)
      if (va < vb) return sort.dir === 'asc' ? -1 : 1
      if (va > vb) return sort.dir === 'asc' ? 1 : -1
      return 0
    })
  }, [baseFiltered, filters.status, sort])

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }))
  const resetFilters = () => setFilters({ period: '', user: '', project: '', status: 'all' })
  const hasFilters = filters.period || filters.user || filters.project || filters.status !== 'all'

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  // ---------- Actions ----------
   const callValidate = async (cra, action, reason = '') => {
    setActionLoading(cra.id)
    try {
      await api.post('/cra-submissions/validate/', {
        cra_id: cra.id,
        action,
        rejection_reason: reason,
      })
      setCras((prev) =>
        prev.map((c) =>
          c.id === cra.id ? { ...c, status: action, rejection_reason: action === 'rejected' ? reason : '' } : c
        )
      )
      const who = cra.user_name?.trim() || cra.user_email
      showMsg('success', action === 'validated' ? `CRA de ${who} validé` : `CRA de ${who} rejeté`)
    } catch (e) {
      showMsg('error', e.message)
    } finally {
      setActionLoading(null)
    }
  }
// Download ficher
  const downloadPdf = async (cra) => {
    try {
      await api.download(`/cra-submissions/${cra.id}/pdf/`, null, `CRA_${periodKey(cra)}.pdf`)
    } catch (e) {
      showMsg('error', e.message)
    }
  }

  const exportExcel = async () => {
    if (!filters.period) return showMsg('warning', 'Sélectionnez un mois dans les filtres pour exporter')
    const [year, month] = filters.period.split('-').map(Number)
    try {
      await api.download(
        '/cra-submissions/export_xlsx/',
        {
          year,
          month,
          project: filters.project,
          user_id: filters.user,
          status: filters.status === 'all' ? '' : filters.status,
        },
        `CRA_${filters.period}.xlsx`
      )
      showMsg('success', 'Export Excel téléchargé')
    } catch (e) {
      showMsg('error', e.message)
    }
  }
    const handleValidate = async (cra) => {
    const who = cra.user_name?.trim() || cra.user_email
    const ok = await ask({
      title: 'Valider le CRA',
      message: `${who} — ${cra.project_name}\n${periodLabel(periodKey(cra))} · ${cra.totalDays} jour(s)`,
      confirmText: 'Valider',
      severity: 'success',
    })
    if (!ok) return
    callValidate(cra, 'validated')
  }

  const handleRejectConfirm = async (reason) => {
    const cra = rejectTarget
    setRejectTarget(null)
    await callValidate(cra, 'rejected', reason)
  }

  // Règles des boutons
  const getActionState = (cra) => {
    const isOwn = Number(cra.user) === Number(user?.id)
    if (isOwn) return { disabled: true, reason: 'Vous ne pouvez pas traiter votre propre CRA' }
    if (cra.status === 'validated') return { disabled: true, reason: 'CRA déjà validé' }
    if (cra.status === 'rejected') return { disabled: true, reason: 'CRA déjà rejeté — en attente de re-soumission' }
    return { disabled: false, reason: '' }
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
    { key: 'all', label: 'Total', color: 'text-gray-900', ring: 'ring-salesforce-blue' },
    { key: 'submitted', label: 'En attente', color: 'text-yellow-600', ring: 'ring-yellow-500' },
    { key: 'validated', label: 'Validés', color: 'text-green-600', ring: 'ring-green-500' },
    { key: 'rejected', label: 'Rejetés', color: 'text-red-600', ring: 'ring-red-500' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Validation des CRA</h1>
        <p className="text-gray-600">Gérez les comptes rendus d'activité de vos collaborateurs</p>
      </div>

      

      {/* Compteurs (filtre statut rapide) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statusCards.map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter('status', s.key)}
            className={`bg-white rounded-lg p-4 shadow-sm border border-gray-200 text-left hover:shadow-md transition-shadow ${
              filters.status === s.key ? `ring-2 ${s.ring}` : ''
            }`}
          >
            <p className="text-sm text-gray-600 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{counts[s.key]}</p>
          </button>
        ))}
      </div>

      {/* Tableau façon Salesforce */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Barre de titre + filtres */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-gray-900">Comptes rendus d'activité</h2>
              <p className="text-xs text-gray-500">
                {rows.length} élément{rows.length > 1 ? 's' : ''} · trié par{' '}
                {{ user: 'collaborateur', project: 'projet', period: 'mois', days: 'jours', status: 'statut', submitted_at: 'date de soumission' }[sort.key]}
              </p>
            </div>
                        <div className="flex gap-2">
              <button
                onClick={exportExcel}
                className="px-3 py-1.5 text-sm border border-green-600 text-green-700 rounded hover:bg-green-50 flex items-center gap-1.5"
                title={filters.period ? `Exporter ${periodLabel(filters.period)}` : 'Choisissez un mois dans les filtres'}
              >
                <IconDownload className="w-4 h-4" /> Exporter Excel
              </button>
                        <button onClick={loadCRAs} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1.5" title="Actualiser">
              <IconRefresh className="w-4 h-4" /> Actualiser
            </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select value={filters.period} onChange={(e) => setFilter('period', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
              <option value="">Tous les mois</option>
              {options.periods.map((p) => (
                <option key={p} value={p}>{periodLabel(p)}</option>
              ))}
            </select>

            <select value={filters.user} onChange={(e) => setFilter('user', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
              <option value="">Tous les collaborateurs</option>
              {options.users.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>

            <select value={filters.project} onChange={(e) => setFilter('project', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
              <option value="">Tous les projets</option>
              {options.projects.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>

            <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
              <option value="all">Tous les statuts</option>
              <option value="submitted">En attente</option>
              <option value="validated">Validé</option>
              <option value="rejected">Rejeté</option>
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

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-8"></th>
                <SortHeader label="Collaborateur" sortKey="user" />
                <SortHeader label="Projet" sortKey="project" />
                <SortHeader label="Mois" sortKey="period" />
                <SortHeader label="Jours" sortKey="days" align="right" />
                <SortHeader label="Soumis le" sortKey="submitted_at" />
                <SortHeader label="Statut" sortKey="status" />
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-gray-500">
                                        <IconClipboard className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    Aucun CRA ne correspond aux filtres
                  </td>
                </tr>
              )}

              {rows.map((cra) => {
                const expanded = expandedId === cra.id
                const action = getActionState(cra)
                const busy = actionLoading === cra.id
                return (
                  <FragmentRow key={cra.id}>
                    <tr className={`border-b border-gray-100 hover:bg-blue-50/40 ${expanded ? 'bg-blue-50/40' : ''}`}>
                      <td className="pl-3">
                        <button
                          onClick={() => setExpandedId(expanded ? null : cra.id)}
                          className="text-gray-400 hover:text-gray-700 transition-transform"
                          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                          title="Voir le détail"
                        >
                                                    <IconChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-salesforce-blue">{cra.user_name?.trim() || '—'}</div>
                        <div className="text-xs text-gray-500">{cra.user_email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900">{cra.project_name || '—'}</div>
                        <div className="text-xs text-gray-500">{cra.project_code}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900">{periodLabel(periodKey(cra))}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{cra.totalDays} j</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDate(cra.submitted_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS[cra.status]?.cls}`}>
                          {STATUS[cra.status]?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2" title={action.reason}>
                           <button
                            onClick={() => downloadPdf(cra)}
                            className="px-2 py-1 text-xs font-medium border border-gray-300 text-gray-700 rounded hover:bg-gray-50 inline-flex items-center gap-1"
                            title="Télécharger la feuille de temps PDF"
                          >
                            <IconDownload className="w-3.5 h-3.5" /> PDF
                          </button>

                          <button
                            onClick={() => setRejectTarget(cra)}
                            disabled={action.disabled || busy}
                            className="px-3 py-1 text-xs font-medium border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          >
                                                        <IconX className="w-3.5 h-3.5" /> Rejeter
                          </button>
                          <button
                            onClick={() => handleValidate(cra)}
                            disabled={action.disabled || busy}
                            className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-green-600"
                          >
                                                        {busy ? <IconPending className="w-3.5 h-3.5 animate-spin" /> : <IconCheck className="w-3.5 h-3.5" />} Valider
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expanded && (
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <td></td>
                        <td colSpan="7" className="px-4 py-4">
                          <CRADetail cra={cra} leaves={leaves.filter((l) => l.user === cra.user && l.date.startsWith(periodKey(cra)))} />
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

      {/* Modal rejet */}
      {rejectTarget && (
        <RejectModal
          cra={rejectTarget}
          onConfirm={handleRejectConfirm}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </div>
  )
}

// Permet de rendre 2 <tr> par CRA sans <div> parasite
const FragmentRow = ({ children }) => <>{children}</>

// ---------- Détail des jours ----------
const CRADetail = ({ cra, leaves = [] }) => {
  const days = [...(cra.entries || [])].sort((a, b) => a.work_date.localeCompare(b.work_date))
  const dayName = (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase text-gray-600 mb-2">
          Jours déclarés ({days.length} entrée{days.length > 1 ? 's' : ''} · {cra.totalDays} j)
        </p>
        {days.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun jour déclaré</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {days.map((e) => {
              const v = parseFloat(e.days_worked)
              return (
                <span
                  key={e.id}
                  className={`px-2 py-1 rounded text-xs border ${
                    v >= 1 ? 'bg-green-50 border-green-300 text-green-800' : 'bg-orange-50 border-orange-300 text-orange-800'
                  }`}
                  title={e.description || ''}
                >
                  {dayName(e.work_date)} · {v}j
                </span>
              )
            })}
          </div>
        )}
      </div>

      {leaves.length > 0 && (
        <div>
                    <p className="text-xs font-semibold uppercase text-gray-600 mb-2 flex items-center gap-1.5">
            <IconLeave className="w-3.5 h-3.5 text-purple-600" /> Congés du mois ({leaves.reduce((s, l) => s + parseFloat(l.days), 0)} j)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {leaves.map((l) => (
              <span key={l.id} className="px-2 py-1 rounded text-xs border bg-purple-50 border-purple-300 text-purple-800">
                {dayName(l.date)} · {parseFloat(l.days)}j · {l.leave_type_label}
              </span>
            ))}
          </div>
        </div>
      )}

           {cra.status === 'rejected' && cra.rejection_reason && (
        <Alert severity="error">
          <AlertTitle>Motif du rejet</AlertTitle>
          {cra.rejection_reason}
        </Alert>
      )}
    </div>
  )
}

// ---------- Modal de rejet ----------
const RejectModal = ({ cra, onConfirm, onClose }) => {
  const [reason, setReason] = useState('')
  const who = cra.user_name?.trim() || cra.user_email

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Rejeter le CRA</h2>
          <p className="text-sm text-gray-600 mt-1">
            {who} · {cra.project_name} · {periodLabel(periodKey(cra))}
          </p>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium mb-2">
            Motif du rejet <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            autoFocus
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Ex. : le 12/09 est un jour férié, merci de corriger."
          />
                    <Alert severity="info" sx={{ mt: 2 }}>
            Le collaborateur verra ce motif et pourra corriger puis re-soumettre.
          </Alert>
        </div>
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Annuler</button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Rejeter
          </button>
        </div>
      </div>
    </div>
  )
}

export default ValidationCRA