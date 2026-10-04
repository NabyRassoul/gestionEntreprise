import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../contexts/AuthContext'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import {
  IconEdit, IconRefresh, IconClose, IconInbox, IconChevronRight, IconEye, IconEyeOff,
  IconRedo, IconLeave, IconHoliday,IconDownload,
} from '../components/Icons'
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const DAY_NAMES = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const STATUS = {
  draft: { label: 'Brouillon', cls: 'bg-gray-100 text-gray-700 border-gray-300' },
  submitted: { label: 'En attente', cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  validated: { label: 'Validé', cls: 'bg-green-100 text-green-800 border-green-300' },
  rejected: { label: 'Rejeté', cls: 'bg-red-100 text-red-800 border-red-300' },
}

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—')

const CRAHistory = () => {
  const { token, user } = useAuth()
 

  const [cras, setCras] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ year: String(new Date().getFullYear()), month: '', project: '', status: '' })
  const [sort, setSort] = useState({ key: 'period', dir: 'desc' })
  const [expandedId, setExpandedId] = useState(null)
    const [leaves, setLeaves] = useState([])     // mes congés
  const [holidays, setHolidays] = useState({}) // "YYYY-MM-DD" → libellé

  useEffect(() => {
    if (token && user?.id) loadCRAs()
  }, [token, user?.id])

  // ---------- Chargement ----------
   const loadCRAs = async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, leavesList] = await Promise.all([
        api.list('/cra-submissions/by_user/', { user_id: user.id, include: 'entries' }),
        api.list('/leaves/', { user_id: user.id }).catch(() => []),
      ])

      // Jours de chaque CRA
        const enriched = list.map((c) => ({
        ...c,
        entries: [...c.entries].sort((a, b) => a.work_date.localeCompare(b.work_date)),
        totalDays: c.total_days,
      }))
      setCras(enriched)
            setLeaves(leavesList.filter((l) => l.user === user.id && l.leave_type !== 'tt'))

      // Jours fériés des années concernées
      const years = [...new Set([...enriched.map((c) => c.year), new Date().getFullYear()])]
      const holidayLists = await Promise.all(
        years.map((y) => api.list('/holidays/', { year: y }).catch(() => []))
      )
      setHolidays(Object.fromEntries(holidayLists.flat().map((h) => [h.date, h.label])))
    } catch (e) {
      console.error('❌ loadCRAs :', e)
      setError(`Impossible de charger l'historique : ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ---------- Options des filtres ----------
  const options = useMemo(() => {
    const years = [...new Set(cras.map((c) => String(c.year)))].sort().reverse()
    if (!years.includes(String(new Date().getFullYear()))) years.unshift(String(new Date().getFullYear()))
    const projects = new Map()
    cras.forEach((c) => c.project && projects.set(String(c.project), `${c.project_name} (${c.project_code})`))
    return { years, projects: [...projects.entries()].sort((a, b) => a[1].localeCompare(b[1])) }
  }, [cras])

  // ---------- Filtrage ----------
  const baseFiltered = useMemo(
    () =>
      cras.filter(
        (c) =>
          (!filters.year || String(c.year) === filters.year) &&
          (!filters.month || String(c.month) === filters.month) &&
          (!filters.project || String(c.project) === filters.project)
      ),
    [cras, filters.year, filters.month, filters.project]
  )

  const stats = {
    validatedDays: baseFiltered.filter((c) => c.status === 'validated').reduce((s, c) => s + c.totalDays, 0),
    validated: baseFiltered.filter((c) => c.status === 'validated').length,
    submitted: baseFiltered.filter((c) => c.status === 'submitted').length,
    rejected: baseFiltered.filter((c) => c.status === 'rejected').length,
  }

  const rows = useMemo(() => {
    const list = baseFiltered.filter((c) => !filters.status || c.status === filters.status)
    const val = (c) => {
      switch (sort.key) {
        case 'project': return (c.project_name || '').toLowerCase()
        case 'days': return c.totalDays
        case 'submitted_at': return c.submitted_at ? new Date(c.submitted_at).getTime() : 0
        case 'status': return c.status
        default: return c.year * 100 + c.month
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
  const resetFilters = () => setFilters({ year: String(new Date().getFullYear()), month: '', project: '', status: '' })
  const hasFilters = filters.month || filters.project || filters.status || filters.year !== String(new Date().getFullYear())

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  const downloadPdf = async (c) => {
    try {
      await api.download(`/cra-submissions/${c.id}/pdf/`, null, `CRA_${c.year}-${String(c.month).padStart(2, '0')}.pdf`)
    } catch (e) {
      setError(e.message)
    }
  }


  const editLink = (c) => `/cra/submit?month=${c.month}&year=${c.year}&project=${c.project}`

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

    const leaveDays = leaves
    .filter((l) => !filters.year || l.date.startsWith(filters.year))
    .reduce((s, l) => s + parseFloat(l.days), 0)

  const yearSuffix = filters.year ? ` · ${filters.year}` : ''
  const cards = [
    { key: 'days', label: `Jours validés${yearSuffix}`, value: `${stats.validatedDays} j`, color: 'text-salesforce-blue', ring: 'ring-salesforce-blue', filter: null },
    { key: 'v', label: 'CRA validés', value: stats.validated, color: 'text-green-600', ring: 'ring-green-500', filter: 'validated' },
    { key: 's', label: 'En attente', value: stats.submitted, color: 'text-yellow-600', ring: 'ring-yellow-500', filter: 'submitted' },
    { key: 'r', label: 'Rejetés', value: stats.rejected, color: 'text-red-600', ring: 'ring-red-500', filter: 'rejected' },
    { key: 'l', label: `Absences${yearSuffix}`, value: `${leaveDays} j`, color: 'text-purple-600', ring: 'ring-purple-500', filter: null },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Historique de mes CRA</h1>
          <p className="text-gray-600">Retrouvez tous vos comptes rendus d'activité par mois et par projet</p>
        </div>
        <Link to="/cra/submit" className="px-4 py-2 bg-salesforce-blue text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
           <IconEdit className="w-4 h-4" /> Saisir mon CRA
        </Link>
      </div>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

           {/* Indicateurs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {cards.map((c) => (
          <button
            key={c.key}
            onClick={() => c.filter && setFilter('status', filters.status === c.filter ? '' : c.filter)}
            className={`bg-white rounded-lg p-4 shadow-sm border border-gray-200 text-left transition-shadow ${
              c.filter ? 'hover:shadow-md' : 'cursor-default'
            } ${c.filter && filters.status === c.filter ? `ring-2 ${c.ring}` : ''}`}
          >
            <p className="text-sm text-gray-600 mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          </button>
        ))}
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-gray-900">Mes CRA</h2>
              <p className="text-xs text-gray-500">{rows.length} élément{rows.length > 1 ? 's' : ''}</p>
            </div>
            <button onClick={loadCRAs} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1.5">
              <IconRefresh className="w-4 h-4" /> Actualiser
              </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select value={filters.year} onChange={(e) => setFilter('year', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
              <option value="">Toutes les années</option>
              {options.years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <select value={filters.month} onChange={(e) => setFilter('month', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
              <option value="">Tous les mois</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>

            <select value={filters.project} onChange={(e) => setFilter('project', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
              <option value="">Tous les projets</option>
              {options.projects.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>

            <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
              <option value="">Tous les statuts</option>
              {Object.entries(STATUS).map(([k, s]) => (
                <option key={k} value={k}>{s.label}</option>
              ))}
            </select>

            <button
              onClick={resetFilters}
              disabled={!hasFilters}
              className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ✕ Réinitialiser
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-8"></th>
                <SortHeader label="Mois" sortKey="period" />
                <SortHeader label="Projet" sortKey="project" />
                <SortHeader label="Jours" sortKey="days" align="right" />
                <SortHeader label="Soumis le" sortKey="submitted_at" />
                <SortHeader label="Statut" sortKey="status" />
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-gray-500">
                    <IconInbox className="w-10 h-10 mx-auto mb-2 text-gray-300" />  
                    Aucun CRA ne correspond aux filtres
                  </td>
                </tr>
              )}

              {rows.map((c) => {
                const expanded = expandedId === c.id
                const editable = ['draft', 'rejected'].includes(c.status)
                return (
                  <FragmentRow key={c.id}>
                    <tr className={`border-b border-gray-100 hover:bg-blue-50/40 ${expanded ? 'bg-blue-50/40' : ''}`}>
                      <td className="pl-3">
                        <button
                          onClick={() => setExpandedId(expanded ? null : c.id)}
                          className="text-gray-400 hover:text-gray-700 transition-transform"
                          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                          title="Voir le détail"
                        >
                          ▸
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedId(expanded ? null : c.id)}
                          className="font-medium text-salesforce-blue hover:underline"
                        >
                          {MONTHS[c.month - 1]} {c.year}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900">{c.project_name || '—'}</div>
                        <div className="text-xs text-gray-500">{c.project_code}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{c.totalDays} j</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDate(c.submitted_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS[c.status]?.cls}`}>
                          {STATUS[c.status]?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2 whitespace-nowrap">
                           <button
                            onClick={() => downloadPdf(c)}
                            className="px-3 py-1 text-xs font-medium border border-gray-300 text-gray-700 rounded hover:bg-gray-50 inline-flex items-center gap-1"
                            title="Télécharger la feuille de temps PDF"
                          >
                            <IconDownload className="w-3.5 h-3.5" /> PDF
                          </button>
                          <button
                            onClick={() => setExpandedId(expanded ? null : c.id)}
                            className="px-3 py-1 text-xs font-medium border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                          >
                            {expanded ? <><IconEyeOff className="w-3.5 h-3.5" /> Masquer</> : <><IconEye className="w-3.5 h-3.5" /> Voir</>}
                          </button>
                          {editable && (
                            <Link
                              to={editLink(c)}
                              className={`px-3 py-1 text-xs font-medium rounded border ${
                                c.status === 'rejected'
                                  ? 'border-red-300 text-red-700 hover:bg-red-50'
                                  : 'border-salesforce-blue text-salesforce-blue hover:bg-blue-50'
                              }`}
                            >
                              {c.status === 'rejected' ? <><IconRedo className="w-3.5 h-3.5" /> Corriger</> : <><IconEdit className="w-3.5 h-3.5" /> Continuer</>}
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>

                    {expanded && (
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <td></td>
                        <td colSpan="6" className="px-4 py-4">
                          <CRADetail
                              cra={c}
                              leaves={leaves.filter((l) => l.date.startsWith(`${c.year}-${String(c.month).padStart(2, '0')}`))}
                              holidays={holidays}
                            />
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
    </div>
  )
}

const FragmentRow = ({ children }) => <>{children}</>

// ---------- Détail : mini-calendrier + liste ----------
const LEAVE_LABELS = { cp: 'CP', maladie: 'Maladie', mariage: 'Mariage', bapteme: 'Baptême', deces: 'Décès', autre: 'Absence' }

const CRADetail = ({ cra, leaves = [], holidays = {} }) => {
  const values = Object.fromEntries(cra.entries.map((e) => [e.work_date, parseFloat(e.days_worked)]))
  const leaveMap = Object.fromEntries(leaves.map((l) => [l.date, l]))

  const year = cra.year
  const monthIdx = cra.month - 1
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
  const offset = (new Date(year, monthIdx, 1).getDay() + 6) % 7
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const dateStr = (d) => `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const isWeekend = (d) => [0, 6].includes(new Date(year, monthIdx, d).getDay())
  const shortDate = (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })

  const full = cra.entries.filter((e) => parseFloat(e.days_worked) >= 1).length
  const half = cra.entries.filter((e) => parseFloat(e.days_worked) < 1).length
  const leaveTotal = leaves.reduce((s, l) => s + parseFloat(l.days), 0)
  const monthHolidays = Object.entries(holidays).filter(([d]) => d.startsWith(dateStr(1).slice(0, 7)))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Mini-calendrier */}
      <div className="bg-white border border-gray-200 rounded p-4">
        <p className="text-xs font-semibold uppercase text-gray-600 mb-3">
          {MONTHS[monthIdx]} {year}
        </p>
        <div className="grid grid-cols-7 gap-1">
          {DAY_NAMES.map((n, i) => (
            <div key={i} className="text-center text-[10px] font-semibold text-gray-500">{n}</div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={i} />
            const ds = dateStr(d)
            const v = values[ds] || 0
            const leave = leaveMap[ds]
            const holiday = holidays[ds]

            let cls = 'bg-white text-gray-500 border-gray-200'
            let title = ''
            if (isWeekend(d)) cls = 'bg-gray-100 text-gray-400 border-gray-200'
            else if (holiday) { cls = 'bg-indigo-50 text-indigo-400 border-indigo-200'; title = holiday }
            else if (v >= 1) { cls = 'bg-green-100 text-green-800 border-green-500'; title = '1j' }
            else if (v > 0 && v < 1 && leave) { cls = 'bg-gradient-to-br from-orange-100 from-50% to-purple-100 to-50% text-gray-800 border-orange-400'; title = `0.5j + ½ ${LEAVE_LABELS[leave.leave_type]}` }
            else if (v > 0 && v < 1) { cls = 'bg-orange-100 text-orange-800 border-orange-500'; title = '0.5j' }
            else if (leave) {
              cls = parseFloat(leave.days) >= 1
                ? 'bg-purple-100 text-purple-800 border-purple-400'
                : 'bg-purple-50 text-purple-700 border-purple-300 border-dashed'
              title = `${LEAVE_LABELS[leave.leave_type]} · ${parseFloat(leave.days)}j`
            }

            return (
              <div key={i} className={`aspect-square rounded border text-[11px] flex items-center justify-center ${cls}`} title={title}>
                {d}
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[11px] text-gray-600">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-400" /> {full} complet(s)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400" /> {half} partiel(s)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-purple-400" /> {leaveTotal}j congé</span>
          {monthHolidays.length > 0 && (
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-300" /> {monthHolidays.length} férié(s)</span>
          )}
        </div>
      </div>

      {/* Listes */}
      <div className="lg:col-span-2 space-y-3">
                {cra.status === 'rejected' && cra.rejection_reason && (
          <Alert severity="error">
            <AlertTitle>Motif du rejet</AlertTitle>
            {cra.rejection_reason}
          </Alert>
        )}

        <div className="bg-white border border-gray-200 rounded">
          <p className="px-4 py-2.5 border-b border-gray-200 text-xs font-semibold uppercase text-gray-600">
            Jours déclarés sur {cra.project_name || 'ce projet'} ({cra.entries.length} · {cra.totalDays} j)
          </p>
          {cra.entries.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500 text-center">Aucun jour déclaré</p>
          ) : (
            <div className="px-4 py-3 flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {cra.entries.map((e) => {
                const v = parseFloat(e.days_worked)
                return (
                  <span
                    key={e.id}
                    className={`px-2 py-1 rounded text-xs border ${
                      v >= 1 ? 'bg-green-50 border-green-300 text-green-800' : 'bg-orange-50 border-orange-300 text-orange-800'
                    }`}
                  >
                    {shortDate(e.work_date)} · {v}j
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {leaves.length > 0 && (
          <div className="bg-white border border-gray-200 rounded">
                        <p className="px-4 py-2.5 border-b border-gray-200 text-xs font-semibold uppercase text-gray-600 flex items-center gap-1.5">
              <IconLeave className="w-3.5 h-3.5 text-purple-600" /> Congés du mois ({leaveTotal} j)
            </p>
            <div className="px-4 py-3 flex flex-wrap gap-1.5">
              {leaves.map((l) => (
                <span key={l.id} className="px-2 py-1 rounded text-xs border bg-purple-50 border-purple-300 text-purple-800">
                  {shortDate(l.date)} · {parseFloat(l.days)}j · {l.leave_type_label || LEAVE_LABELS[l.leave_type]}
                </span>
              ))}
            </div>
          </div>
        )}

        {monthHolidays.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {monthHolidays.map(([d, label]) => (
              <span key={d} className="px-2 py-1 text-xs rounded bg-indigo-50 border border-indigo-200 text-indigo-700 inline-flex items-center gap-1">
                <IconHoliday className="w-3 h-3" /> {shortDate(d)} · {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CRAHistory