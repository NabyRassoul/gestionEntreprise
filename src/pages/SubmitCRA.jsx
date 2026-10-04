import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import { useAuth } from '../contexts/AuthContext'
import { useFeedback } from '../contexts/FeedbackContext'
import api from '../api'
import {
  IconPending, IconCheck, IconX, IconChevronLeft, IconChevronRight, IconCalendar, IconTrash,
  IconEye, IconEdit, IconHoliday, IconSend, IconRedo, IconPlus,  IconLeave,
} from '../components/Icons'

const STATUS_LABELS = { draft: 'Brouillon', submitted: 'Soumis', validated: 'Validé', rejected: 'Rejeté' }
const DAY_VALUES = [1, 0.75, 0.5, 0.25]
const HOURS = { 1: '8h', 0.75: '6h', 0.5: '4h', 0.25: '2h' }
const VALUE_STYLES = {
  1: { cell: 'bg-green-100 border-green-500', text: 'text-green-800', bar: 'bg-green-500' },
  0.75: { cell: 'bg-teal-50 border-teal-500', text: 'text-teal-800', bar: 'bg-teal-500' },
  0.5: { cell: 'bg-orange-100 border-orange-500', text: 'text-orange-800', bar: 'bg-orange-500' },
  0.25: { cell: 'bg-amber-50 border-amber-400', text: 'text-amber-800', bar: 'bg-amber-400' },
}
const LEAVE_SHORT = { cp: 'CP', tt: 'TT', maladie: 'Maladie', mariage: 'Mariage', bapteme: 'Baptême', deces: 'Décès', autre: 'Absence' }

const fmtDay = (v) => `${String(Math.round(v * 100) / 100).replace('.', ',')}j`
const pad = (n) => String(n).padStart(2, '0')
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const SubmitCRA = () => {
  const { token, user } = useAuth()
  const { notify, confirm: ask } = useFeedback()
  const showMsg = (type, text) => notify(type, text)

  const [searchParams] = useSearchParams()
  const qMonth = Number(searchParams.get('month'))
  const qYear = Number(searchParams.get('year'))
  const qProject = Number(searchParams.get('project'))

  const [currentMonth, setCurrentMonth] = useState(qMonth ? qMonth - 1 : new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(qYear || new Date().getFullYear())
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(qProject || null)
  const [cras, setCras] = useState([])                 // CRA du mois (un par projet)
  const [entries, setEntries] = useState({})           // "YYYY-MM-DD|projectId" → { id, value }
  const [leaves, setLeaves] = useState({})             // "YYYY-MM-DD" → absence validée
  const [pendingLeaves, setPendingLeaves] = useState({}) // "YYYY-MM-DD" → demande en attente
  const [holidays, setHolidays] = useState({})         // "YYYY-MM-DD" → libellé
  const [craLoaded, setCraLoaded] = useState(false)
  const [showPeriodModal, setShowPeriodModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [menuDay, setMenuDay] = useState(null)
  const menuRef = useRef(null)

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  const dayNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

  const today = new Date()
  const isCurrentMonth = currentMonth === today.getMonth() && currentYear === today.getFullYear()

  const craSubmission = cras.find((c) => Number(c.project) === selectedProject) || null
  const getCRAForProject = (pid) => cras.find((c) => Number(c.project) === pid) || null

  // ---------- Chargement ----------
  useEffect(() => {
    if (token && user?.id) loadProjects()
  }, [token, user?.id])

  useEffect(() => {
    if (token && user?.id) loadCRAData()
  }, [currentMonth, currentYear, token, user?.id])

  useEffect(() => {
    if (!token) return
    api.list('/holidays/', { year: currentYear })
      .then((list) => setHolidays(Object.fromEntries(list.map((h) => [h.date, h.label]))))
      .catch(() => setHolidays({}))
  }, [currentYear, token])

  // Lien d'une notification ou de l'historique (?month=&year=&project=)
  useEffect(() => {
    if (qMonth) setCurrentMonth(qMonth - 1)
    if (qYear) setCurrentYear(qYear)
    if (qProject) setSelectedProject(qProject)
  }, [searchParams])

  // Menu « + » : fermeture au clic extérieur / Échap / changement de contexte
  useEffect(() => {
    if (!menuDay) return
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || e.target.closest('[data-day-menu-toggle]')) return
      setMenuDay(null)
    }
    const onKey = (e) => e.key === 'Escape' && setMenuDay(null)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuDay])

  useEffect(() => setMenuDay(null), [currentMonth, currentYear, selectedProject])

  const loadProjects = async () => {
    try {
      const list = await api.list('/assignments/by_user/', { user_id: user.id })
      const projectsList = list.map((a) => ({
        id: typeof a.project === 'object' ? a.project.id : a.project,
        name: a.project_name ?? a.project?.name,
        code: a.project_code ?? a.project?.code,
      }))
      setProjects(projectsList)
      if (projectsList.length > 0) setSelectedProject((prev) => prev ?? projectsList[0].id)
      else showMsg('warning', 'Aucun projet attribué. Contactez votre manager.')
    } catch (e) {
      showMsg('error', `Erreur chargement projets : ${e.message}`)
    }
  }

  const findCRAsForMonth = async () => {
    const list = await api
      .list('/cra-submissions/by_user/', { user_id: user.id, include: 'entries' })
      .catch(() => [])
    return list.filter((c) => Number(c.month) === currentMonth + 1 && Number(c.year) === currentYear)
  }

  const loadEntriesFor = (craList) => {
    const map = {}
    craList.forEach((c) =>
      (c.entries || []).forEach((e) => {
        map[`${e.work_date}|${e.project}`] = { id: e.id, value: parseFloat(e.days_worked) }
      })
    )
    setEntries(map)
  }

  const loadLeaves = async () => {
    const [approved, pending] = await Promise.all([
      api.list('/leaves/', { user_id: user.id, year: currentYear, month: currentMonth + 1 }).catch(() => []),
      api.list('/leave-requests/', { mine: 1, status: 'pending', year: currentYear }).catch(() => []),
    ])

    setLeaves(
      Object.fromEntries(
        approved
          .filter((l) => l.user === user.id && l.leave_type !== 'tt')
          .map((l) => [l.date, {
            days: parseFloat(l.days),
            type: l.leave_type,
            label: l.leave_type_label,
            blocking: l.blocking,
            period: l.period,
          }])
      )
    )

    const pend = {}
      pending.filter((r) => r.leave_type !== 'tt').forEach((r) => {
      const end = new Date(`${r.end_date}T00:00`)
      for (let d = new Date(`${r.start_date}T00:00`); d <= end; d.setDate(d.getDate() + 1)) {
        pend[toIso(d)] = r
      }
    })
    setPendingLeaves(pend)
  }

  const loadCRAData = async () => {
    setCraLoaded(false)
    try {
      const list = await findCRAsForMonth()
      setCras(list)
      loadEntriesFor(list)
      await loadLeaves()
    } catch (error) {
      console.error('❌ loadCRAData :', error)
    } finally {
      setCraLoaded(true)
    }
  }

  // ---------- Helpers calendrier ----------
  const getDaysInMonth = () => {
    const firstDay = new Date(currentYear, currentMonth, 1)
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const startDayOfWeek = (firstDay.getDay() + 6) % 7
    const days = []
    for (let i = 0; i < startDayOfWeek; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) days.push(d)
    return days
  }

  const isWeekend = (day) => {
    if (!day) return false
    const dow = new Date(currentYear, currentMonth, day).getDay()
    return dow === 0 || dow === 6
  }

  const getDateString = (day) => `${currentYear}-${pad(currentMonth + 1)}-${pad(day)}`
  const getHoliday = (day) => (day ? holidays[getDateString(day)] : null)
  const entryKey = (dateStr, projectId) => `${dateStr}|${projectId}`

  // Absence bloquante (le TT ne bloque pas)
  const getBlockingLeaveDays = (dateStr) => {
    const l = leaves[dateStr]
    return l && l.blocking ? l.days : 0
  }

  const getDayTotal = (dateStr) =>
    Object.entries(entries)
      .filter(([k]) => k.startsWith(`${dateStr}|`))
      .reduce((sum, [, e]) => sum + e.value, 0) + getBlockingLeaveDays(dateStr)

  const getProjectValue = (dateStr, pid) => entries[entryKey(dateStr, pid)]?.value || 0

  const getDayDetail = (dateStr) => {
    const lines = Object.entries(entries)
      .filter(([k]) => k.startsWith(`${dateStr}|`))
      .map(([k, e]) => {
        const pid = parseInt(k.split('|')[1])
        const p = projects.find((x) => x.id === pid)
        return `${p ? p.code : pid} : ${fmtDay(e.value)}`
      })
    const l = leaves[dateStr]
    if (l) lines.push(`${l.label} : ${fmtDay(l.days)}${l.type === 'tt' ? ' (jour travaillé)' : ''}`)
    if (!l && pendingLeaves[dateStr]) lines.push(`Demande en attente : ${pendingLeaves[dateStr].leave_type_label}`)
    return lines.join('\n')
  }

  // ---------- Statuts ----------
  const status = craSubmission?.status
  const isDraft = status === 'draft'
  const isRejected = status === 'rejected'
  const canEdit = craLoaded && !!selectedProject && (!craSubmission || isDraft || isRejected)

  // ---------- API ----------
  const ensureDraft = async () => {
    if (craSubmission) return craSubmission

    let cra = null
    try {
      cra = await api.post('/cra-submissions/', {
        user: user.id,
        project: selectedProject,
        month: currentMonth + 1,
        year: currentYear,
        status: 'draft',
      })
      setCras((prev) => [...prev, cra])
    } catch {
      const list = await findCRAsForMonth()
      setCras(list)
      cra = list.find((c) => Number(c.project) === selectedProject) || null
    }

    if (!cra) {
      showMsg('error', 'Impossible de créer ou retrouver le CRA de ce projet')
      return null
    }
    if (!['draft', 'rejected'].includes(cra.status)) {
      showMsg('error', `Le CRA de ce projet est déjà ${STATUS_LABELS[cra.status].toLowerCase()}`)
      return null
    }
    return cra
  }

  const saveEntry = async (craId, dateStr, projectId, value, existing) => {
    if (existing && value === 0) {
      await api.delete(`/cra-entries/${existing.id}/`).catch((e) => {
        if (e.status !== 404) throw e
      })
      return null
    }
    if (existing) {
      await api.patch(`/cra-entries/${existing.id}/`, { days_worked: value })
      return { id: existing.id, value }
    }
    if (value > 0) {
      const data = await api.post('/cra-entries/', {
        cra_submission: craId,
        project: projectId,
        work_date: dateStr,
        days_worked: value,
        description: '',
      })
      return { id: data.id, value }
    }
    return null
  }

  // ---------- Actions ----------
  const handleDayClick = (day) => {
    if (!day || isWeekend(day) || !canEdit) return
    if (getHoliday(day)) {
      showMsg('error', `${getHoliday(day)} : jour férié`)
      return
    }
    const dateStr = getDateString(day)
    const current = getProjectValue(dateStr, selectedProject)
    const max = 1 - (getDayTotal(dateStr) - current)
    if (max <= 0) {
      const l = leaves[dateStr]
      showMsg('error', l?.blocking ? `${l.label} validé ce jour-là` : 'Journée déjà complète sur un autre projet')
      return
    }
    const cycle = [...DAY_VALUES, 0].filter((v) => v <= max + 1e-9)
    applyDayValue(day, cycle[(cycle.indexOf(current) + 1) % cycle.length])
  }

  const applyDayValue = async (day, newValue) => {
    const dateStr = getDateString(day)
    try {
      const cra = await ensureDraft()
      if (!cra) return
      const k = entryKey(dateStr, selectedProject)
      const saved = await saveEntry(cra.id, dateStr, selectedProject, newValue, entries[k])
      setEntries((prev) => {
        const next = { ...prev }
        if (saved) next[k] = saved
        else delete next[k]
        return next
      })
    } catch (error) {
      console.error(error)
      showMsg('error', error.message || 'Erreur enregistrement du jour')
      await loadCRAData()
    }
  }

  const fillPeriod = async (startDate, endDate) => {
    if (!canEdit) return
    const cra = await ensureDraft()
    if (!cra) return

    const [sy, sm, sd] = startDate.split('-').map(Number)
    const [ey, em, ed] = endDate.split('-').map(Number)
    const start = new Date(sy, sm - 1, sd)
    const end = new Date(ey, em - 1, ed)

    const tasks = []
    let skipped = 0

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) continue
      const day = d.getDate()
      if (isWeekend(day) || getHoliday(day)) continue

      const dateStr = getDateString(day)
      const current = getProjectValue(dateStr, selectedProject)
      const value = Math.max(0, 1 - (getDayTotal(dateStr) - current))
      if (value === 0) {
        skipped++
        continue
      }
      const k = entryKey(dateStr, selectedProject)
      tasks.push(saveEntry(cra.id, dateStr, selectedProject, value, entries[k]).then((saved) => ({ key: k, saved })))
    }

    setLoading(true)
    try {
      const results = await Promise.all(tasks)
      setEntries((prev) => {
        const next = { ...prev }
        results.forEach(({ key, saved }) => {
          if (saved) next[key] = saved
        })
        return next
      })
      showMsg('success', skipped ? `Période remplie (${skipped} jour(s) déjà occupé(s) ignoré(s))` : 'Période remplie !')
    } catch (error) {
      console.error(error)
      showMsg('error', error.message || 'Erreur pendant le remplissage')
      await loadCRAData()
    }
    setLoading(false)
  }

  const handleDeleteDraft = async () => {
    if (!craSubmission) return
    const ok = await ask({
      title: 'Supprimer le brouillon',
      message: 'Le brouillon de ce projet et tous ses jours seront supprimés.',
      confirmText: 'Supprimer',
      severity: 'error',
    })
    if (!ok) return
    try {
      await api.delete(`/cra-submissions/${craSubmission.id}/`)
      setCras((prev) => prev.filter((c) => c.id !== craSubmission.id))
      setEntries((prev) => {
        const next = {}
        Object.entries(prev).forEach(([k, e]) => {
          if (!k.endsWith(`|${selectedProject}`)) next[k] = e
        })
        return next
      })
      showMsg('success', 'Brouillon supprimé')
    } catch (error) {
      showMsg('error', error.message || 'Erreur suppression')
    }
  }

  // ---------- Stats ----------
  const days = getDaysInMonth()
  const workingDays = days.filter((d) => d && !isWeekend(d) && !getHoliday(d))
  const selectedValues = days.filter((d) => d).map((d) => getProjectValue(getDateString(d), selectedProject))
  const monthTotal = Math.round(selectedValues.reduce((s, v) => s + v, 0) * 4) / 4
  const leaveTotal = Object.values(leaves).filter((l) => l.blocking).reduce((s, l) => s + l.days, 0)
  const remaining = Math.round(
    workingDays.reduce((s, d) => s + Math.max(0, 1 - getDayTotal(getDateString(d))), 0) * 4
  ) / 4

  const handleSubmitCRA = async () => {
    if (monthTotal === 0) {
      showMsg('error', 'Remplissez au moins un jour')
      return
    }
    const p = projects.find((x) => x.id === selectedProject)
    const warn = remaining > 0
      ? `\n\n⚠️ ${fmtDay(remaining)} ouvré(s) du mois ne sont renseignés ni sur un projet ni en absence.`
      : ''
    const ok = await ask({
      title: 'Soumettre le CRA',
      message: `${fmtDay(monthTotal)} sur ${p?.name} pour ${monthNames[currentMonth]} ${currentYear}.${warn}\n\nAprès soumission, le CRA n'est plus modifiable sauf rejet.`,
      confirmText: 'Soumettre',
      severity: remaining > 0 ? 'warning' : 'info',
    })
    if (!ok) return

    setLoading(true)
    try {
      await api.post('/cra-submissions/submit/', { cra_id: craSubmission.id })
      showMsg('success', `CRA ${p?.name} soumis !`)
      await loadCRAData()
    } catch (e) {
      showMsg('error', e.message)
    }
    setLoading(false)
  }

  const changeMonth = (delta) => {
    const d = new Date(currentYear, currentMonth + delta, 1)
    setCurrentMonth(d.getMonth())
    setCurrentYear(d.getFullYear())
  }

  const monthPrefix = `${currentYear}-${pad(currentMonth + 1)}`
  const monthHolidays = Object.entries(holidays).filter(([d]) => d.startsWith(monthPrefix))
  const canSubmitMonth = isCurrentMonth || isRejected

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon CRA - Calendrier</h1>
          <p className="text-gray-600 mt-1">
            {monthNames[currentMonth]} {currentYear}
            {selectedProject && craLoaded && (
              <>
                {!craSubmission && <span className="ml-3 inline-block px-2 py-1 bg-gray-50 text-gray-500 text-xs font-medium rounded">Non commencé</span>}
                {isDraft && <span className="ml-3 inline-block px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded">Brouillon</span>}
                {status === 'submitted' && <span className="ml-3 inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded"><IconPending className="w-3.5 h-3.5" /> Soumis</span>}
                {status === 'validated' && <span className="ml-3 inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded"><IconCheck className="w-3.5 h-3.5" /> Validé</span>}
                {isRejected && <span className="ml-3 inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded"><IconX className="w-3.5 h-3.5" /> Rejeté</span>}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => changeMonth(-1)} className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-1">
            <IconChevronLeft className="w-4 h-4" /> Mois précédent
          </button>
          <button onClick={() => changeMonth(1)} className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-1">
            Mois suivant <IconChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sélection du projet */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium mb-2">Projet</label>
              <select
                value={selectedProject || ''}
                onChange={(e) => setSelectedProject(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Sélectionner...</option>
                {projects.map((p) => {
                  const c = getCRAForProject(p.id)
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code}){c ? ` — ${STATUS_LABELS[c.status]}` : ''}
                    </option>
                  )
                })}
              </select>
            </div>
            <button
              onClick={() => setShowPeriodModal(true)}
              className="px-4 py-2 bg-salesforce-blue text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={!canEdit || loading}
            >
              <IconCalendar className="w-4 h-4" /> Remplir période
            </button>
            {isDraft && (
              <button onClick={handleDeleteDraft} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2">
                <IconTrash className="w-4 h-4" /> Supprimer
              </button>
            )}
            <Link
              to="/leaves"
              className="px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 flex items-center gap-2"
              title="Congés, télétravail, absences"
            >
              <IconLeave className="w-4 h-4" /> Poser une absence
            </Link>
          </div>
        </div>
      </div>

      {/* Motif de rejet */}
      {isRejected && craSubmission?.rejection_reason && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>CRA rejeté</AlertTitle>
          {craSubmission.rejection_reason}
          <br />
          Corrigez vos jours puis re-soumettez.
        </Alert>
      )}

      {/* Info lecture seule */}
      {craLoaded && status === 'submitted' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          CRA de ce projet soumis
          {craSubmission?.submitted_at && ` le ${new Date(craSubmission.submitted_at).toLocaleDateString('fr-FR')}`}, en attente de
          validation. Vous pouvez sélectionner un autre projet.
        </Alert>
      )}
      {craLoaded && status === 'validated' && (
        <Alert severity="success" sx={{ mb: 2 }}>
          CRA de ce projet validé, aucune modification possible.
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card"><div className="card-body">
          <p className="text-sm text-gray-600 mb-1">Ce projet</p>
          <p className="text-3xl font-bold text-salesforce-blue">{fmtDay(monthTotal)}</p>
        </div></div>
        <div className="card"><div className="card-body">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-gray-600">Absences du mois</p>
            <Link to="/leaves" className="text-xs text-purple-700 hover:underline">Gérer →</Link>
          </div>
          <p className="text-3xl font-bold text-purple-600">{fmtDay(leaveTotal)}</p>
          
        </div></div>
        <div className="card"><div className="card-body">
          <p className="text-sm text-gray-600 mb-1">Jours ouvrés restants</p>
          <p className={`text-3xl font-bold ${remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>{fmtDay(remaining)}</p>
          <p className="text-xs text-gray-500 mt-1">sur {workingDays.length} jours ouvrés (hors fériés)</p>
        </div></div>
      </div>

      {/* Légende */}
      <div className="card mb-4">
        <div className="card-body">
          <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2 flex-wrap">
            {!canEdit ? (
              <><IconEye className="w-4 h-4 text-gray-500" /> Calendrier en lecture seule pour ce projet</>
            ) : (
              <><IconEdit className="w-4 h-4 text-salesforce-blue" /> Cliquez sur une case : 1j → 0,75 → 0,5 → 0,25 → vide · ou survolez-la et utilisez <IconPlus className="w-3.5 h-3.5 inline" /> pour choisir</>
            )}
          </p>
          <div className="flex gap-x-5 gap-y-2 flex-wrap">
            <Legend cls="border-green-500 bg-green-100" label="1j · 8h" />
            <Legend cls="border-teal-500 bg-teal-50" label="0,75j · 6h" />
            <Legend cls="border-orange-500 bg-orange-100" label="0,5j · 4h" />
            <Legend cls="border-amber-400 bg-amber-50" label="0,25j · 2h" />
            <Legend cls="border-purple-400 bg-purple-100" label="Absence validée" />
            
            <Legend cls="border-purple-300 border-dashed bg-white" label="Demande en attente" />
            <Legend cls="border-slate-300 bg-slate-200" label="Autre projet" />
            <Legend cls="border-indigo-200 bg-indigo-50" label="Jour férié" />
            <Legend cls="border-gray-300 bg-white" label="Libre" />
          </div>
        </div>
      </div>

      {/* Calendrier */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="grid grid-cols-7 gap-1 max-w-2xl mx-auto">
            {dayNames.map((name, i) => (
              <div key={i} className="text-center text-sm font-semibold text-gray-600 py-2">{name}</div>
            ))}

            {days.map((day, index) => {
              if (!day) return <div key={index} className="invisible" />

              const dateStr = getDateString(day)
              const weekend = isWeekend(day)
              const holiday = getHoliday(day)
              const leave = leaves[dateStr]
             
              const blockingLeave = getBlockingLeaveDays(dateStr)
              const pendingReq = !leave ? pendingLeaves[dateStr] : null
              const own = getProjectValue(dateStr, selectedProject)
              const others = getDayTotal(dateStr) - own
              const available = Math.max(0, 1 - others)
              const blocked = own === 0 && others >= 1
              const isClickable = !weekend && !holiday && canEdit && !blocked
              const menuOpen = menuDay === day
              const alignRight = index % 7 >= 4

              let colorClass = 'bg-white border-gray-300'
              let textColorClass = 'text-gray-900'
              let sub = null

              if (holiday) {
                colorClass = 'bg-indigo-50 border-indigo-200'
                textColorClass = 'text-indigo-400'
                sub = 'Férié'
              } else if (own > 0) {
                const s = VALUE_STYLES[own] || VALUE_STYLES[0.5]
                colorClass = s.cell
                textColorClass = s.text
                sub = fmtDay(own)
              } else if (blockingLeave >= 1) {
                colorClass = 'bg-purple-100 border-purple-400'
                textColorClass = 'text-purple-700'
                sub = LEAVE_SHORT[leave.type] || 'Absence'
              } else if (others >= 1) {
                colorClass = 'bg-slate-200 border-slate-300'
                textColorClass = 'text-slate-500'
                sub = 'pris'
              } else if (blockingLeave > 0) {
                colorClass = 'bg-purple-50 border-purple-300 border-dashed'
                textColorClass = 'text-purple-600'
                sub = `½ ${LEAVE_SHORT[leave.type] || 'abs.'}`
              } else if (others > 0) {
                colorClass = 'bg-slate-50 border-slate-300 border-dashed'
                textColorClass = 'text-slate-500'
                sub = `${fmtDay(available)} dispo`
              } else if (pendingReq) {
                colorClass = 'bg-white border-purple-300 border-dashed'
                textColorClass = 'text-purple-500'
                sub = 'Demande'
              }

              return (
                <div
                  key={index}
                  onClick={() => handleDayClick(day)}
                  title={holiday || getDayDetail(dateStr) || (own ? HOURS[own] : '')}
                  className={`
                    group relative aspect-square p-1 rounded border-2 flex flex-col items-center justify-center transition-all text-sm
                    ${weekend ? 'bg-gray-100 border-gray-200 cursor-not-allowed' : colorClass}
                    ${isClickable ? 'hover:shadow-md cursor-pointer' : ''}
                    ${!weekend && !isClickable ? 'cursor-not-allowed' : ''}
                    ${menuOpen ? 'ring-2 ring-salesforce-blue z-20' : ''}
                  `}
                >
                  {/* Marqueurs en coin : télétravail / demande en attente */}
                  
                  {!weekend  && pendingReq && <IconPending className="absolute top-0.5 left-0.5 w-3 h-3 text-purple-500" />}

                  <div className={`text-sm font-semibold ${textColorClass}`}>{day}</div>
                  {!weekend && sub && <div className={`text-[9px] mt-0.5 font-medium ${textColorClass}`}>{sub}</div>}

                  {/* Jauge */}
                  {own > 0 && !holiday && (
                    <div className="absolute bottom-1 left-1.5 right-1.5 h-1 rounded-full bg-black/5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${VALUE_STYLES[own]?.bar}`} style={{ width: `${own * 100}%` }} />
                    </div>
                  )}

                  {/* Bouton + */}
                  {isClickable && (
                    <button
                      type="button"
                      data-day-menu-toggle
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuDay(menuOpen ? null : day)
                      }}
                      className={`absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center bg-white border border-gray-300 text-gray-500 shadow-sm hover:bg-salesforce-blue hover:text-white hover:border-salesforce-blue transition ${
                        menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      title="Choisir une valeur"
                    >
                      <IconPlus className="w-2.5 h-2.5" />
                    </button>
                  )}

                  {/* Menu de choix rapide */}
                  {menuOpen && (
                    <div
                      ref={menuRef}
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute top-full mt-1 z-30 w-44 bg-white rounded-lg shadow-xl border border-gray-200 py-1 text-left ${alignRight ? 'right-0' : 'left-0'}`}
                    >
                      <p className="px-3 pt-1 pb-1.5 text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                        {day} {monthNames[currentMonth]} · {fmtDay(available)} dispo
                      </p>
                      {DAY_VALUES.map((v) => {
                        const disabled = v > available + 1e-9
                        const active = own === v
                        return (
                          <button
                            key={v}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              setMenuDay(null)
                              applyDayValue(day, v)
                            }}
                            className={`w-full px-3 py-1.5 text-sm flex items-center justify-between transition-colors ${
                              active ? 'bg-blue-50 text-salesforce-blue font-semibold' : 'text-gray-700 hover:bg-gray-50'
                            } disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
                          >
                            <span className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-sm ${VALUE_STYLES[v].bar}`} />
                              {fmtDay(v)}
                            </span>
                            <span className="text-xs text-gray-400">{HOURS[v]}</span>
                          </button>
                        )
                      })}
                      {own > 0 && (
                        <>
                          <div className="my-1 border-t border-gray-100" />
                          <button
                            type="button"
                            onClick={() => {
                              setMenuDay(null)
                              applyDayValue(day, 0)
                            }}
                            className="w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <IconTrash className="w-3.5 h-3.5" /> Effacer
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {monthHolidays.length > 0 && (
            <div className="max-w-2xl mx-auto mt-4 flex flex-wrap gap-2">
              {monthHolidays.map(([d, label]) => (
                <span key={d} className="px-2 py-1 text-xs rounded bg-indigo-50 border border-indigo-200 text-indigo-700 inline-flex items-center gap-1">
                  <IconHoliday className="w-3 h-3" /> {new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} · {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bouton soumettre */}
      {canEdit && craSubmission && monthTotal > 0 && (
        <div className="flex justify-end items-center gap-4">
          {!canSubmitMonth && (
            <Alert severity="warning" sx={{ py: 0 }}>Soumission possible uniquement pour le mois en cours</Alert>
          )}
          <button
            onClick={handleSubmitCRA}
            disabled={loading || !canSubmitMonth}
            className={`px-6 py-3 bg-green-600 text-white rounded-lg font-semibold text-lg hover:bg-green-700 flex items-center gap-2 ${
              loading || !canSubmitMonth ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? (
              <><IconPending className="w-5 h-5 animate-spin" /> Envoi...</>
            ) : isRejected ? (
              <><IconRedo className="w-5 h-5" /> Re-soumettre ce projet</>
            ) : (
              <><IconSend className="w-5 h-5" /> Soumettre ce projet</>
            )}
          </button>
        </div>
      )}

      {/* Modal */}
      {showPeriodModal && (
        <PeriodModal
          month={currentMonth}
          year={currentYear}
          onSave={fillPeriod}
          onClose={() => setShowPeriodModal(false)}
        />
      )}
    </div>
  )
}

const Legend = ({ cls, label }) => (
  <div className="flex items-center gap-2">
    <div className={`w-6 h-6 rounded border-2 ${cls}`}></div>
    <span className="text-sm text-gray-700">{label}</span>
  </div>
)

const PeriodModal = ({ month, year, onSave, onClose }) => {
  const mm = pad(month + 1)
  const lastDay = pad(new Date(year, month + 1, 0).getDate())
  const minDate = `${year}-${mm}-01`
  const maxDate = `${year}-${mm}-${lastDay}`

  const [startDate, setStartDate] = useState(minDate)
  const [endDate, setEndDate] = useState(maxDate)
  const [error, setError] = useState(null)

  const handleSave = () => {
    if (!startDate || !endDate) return setError('Remplissez les deux dates')
    if (startDate > endDate) return setError('La date de début doit être avant la date de fin')
    onSave(startDate, endDate)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <IconCalendar className="w-5 h-5 text-salesforce-blue" /> Remplir une période
          </h2>
          <p className="text-sm text-gray-600 mt-1">Chaque jour ouvré = ce qui reste disponible, sur le projet sélectionné</p>
        </div>
        <div className="p-6 space-y-4">
          {error && <Alert severity="error">{error}</Alert>}
          <div>
            <label className="block text-sm font-medium mb-2">Date début</label>
            <input type="date" value={startDate} min={minDate} max={maxDate}
              onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Date fin</label>
            <input type="date" value={endDate} min={minDate} max={maxDate}
              onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <Alert severity="info">
            Week-ends, jours fériés et absences validées sont ignorés. Les jours partiellement occupés ne sont complétés que sur ce qui reste.
          </Alert>
        </div>
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Annuler</button>
          <button onClick={handleSave} className="px-4 py-2 bg-salesforce-blue text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <IconCheck className="w-4 h-4" /> Remplir
          </button>
        </div>
      </div>
    </div>
  )
}

export default SubmitCRA