import { useState, useEffect } from 'react'
import api from '../api'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import { useFeedback } from '../contexts/FeedbackContext'
import {
  IconLeave, IconPending, IconCheck, IconX, IconChevronLeft, IconChevronRight, IconCalendar,
  IconTrash, IconEye, IconEdit, IconHoliday, IconWarning, IconSend, IconRedo,
} from '../components/Icons'
const STATUS_LABELS = { draft: 'Brouillon', submitted: 'Soumis', validated: 'Validé', rejected: 'Rejeté' }
const LEAVE_TYPES = { paid: 'Congé payé', sick: 'Maladie', unpaid: 'Sans solde', other: 'Autre' }
const LEAVE = 'leave'

const SubmitCRA = () => {
  const { token, user } = useAuth()


  const [searchParams] = useSearchParams()
  const qMonth = Number(searchParams.get('month'))
  const qYear = Number(searchParams.get('year'))
  const qProject = Number(searchParams.get('project'))

  const [currentMonth, setCurrentMonth] = useState(qMonth ? qMonth - 1 : new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(qYear || new Date().getFullYear())
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(qProject || null) // id projet ou 'leave'
  const [cras, setCras] = useState([])        // CRA du mois (un par projet)
  const [entries, setEntries] = useState({})  // "YYYY-MM-DD|projectId" → { id, value }
  const [leaves, setLeaves] = useState({})    // "YYYY-MM-DD" → { id, days, type }
  const [holidays, setHolidays] = useState({}) // "YYYY-MM-DD" → libellé
  const [leaveType, setLeaveType] = useState('paid')
  const [craLoaded, setCraLoaded] = useState(false)
  const [showPeriodModal, setShowPeriodModal] = useState(false)

  const [loading, setLoading] = useState(false)

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  const dayNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

  const today = new Date()
  const isCurrentMonth = currentMonth === today.getMonth() && currentYear === today.getFullYear()



  const { notify, confirm: ask } = useFeedback()
  const showMsg = (type, text) => notify(type, text)



  const isLeaveMode = selectedProject === LEAVE
  const craSubmission = isLeaveMode ? null : cras.find((c) => Number(c.project) === selectedProject) || null
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

  useEffect(() => {
    if (qMonth) setCurrentMonth(qMonth - 1)
    if (qYear) setCurrentYear(qYear)
    if (qProject) setSelectedProject(qProject)
  }, [searchParams])

  const loadProjects = async () => {
    try {
      const list = await api.list('/assignments/by_user/', { user_id: user.id })
      const projectsList = list.map((a) => ({
        id: typeof a.project === 'object' ? a.project.id : a.project,
        name: a.project_name ?? a.project?.name,
        code: a.project_code ?? a.project?.code,
      }))
      setProjects(projectsList)
      if (projectsList.length > 0) {
        setSelectedProject((prev) => prev ?? projectsList[0].id)
      } else {
        setSelectedProject((prev) => prev ?? LEAVE)
      }
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
    const list = await api
      .list('/leaves/', { user_id: user.id, year: currentYear, month: currentMonth + 1 })
      .catch(() => [])
    setLeaves(
      Object.fromEntries(
        list
          .filter((l) => l.user === user.id)
          .map((l) => [l.date, { id: l.id, days: parseFloat(l.days), type: l.leave_type }])
      )
    )
  }

  const loadCRAData = async () => {
    setCraLoaded(false)
    try {
      const list = await findCRAsForMonth()
      setCras(list)
      await Promise.all([loadEntriesFor(list), loadLeaves()])
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

  const getDateString = (day) =>
    `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const getHoliday = (day) => (day ? holidays[getDateString(day)] : null)

  const entryKey = (dateStr, projectId) => `${dateStr}|${projectId}`

  const getLeaveDays = (dateStr) => leaves[dateStr]?.days || 0

  const getDayTotal = (dateStr) =>
    Object.entries(entries)
      .filter(([k]) => k.startsWith(`${dateStr}|`))
      .reduce((sum, [, e]) => sum + e.value, 0) + getLeaveDays(dateStr)

  const getProjectValue = (dateStr, pid) =>
    pid === LEAVE ? getLeaveDays(dateStr) : entries[entryKey(dateStr, pid)]?.value || 0

  const getDayDetail = (dateStr) => {
    const lines = Object.entries(entries)
      .filter(([k]) => k.startsWith(`${dateStr}|`))
      .map(([k, e]) => {
        const pid = parseInt(k.split('|')[1])
        const p = projects.find((x) => x.id === pid)
        return `${p ? p.code : pid} : ${e.value}j`
      })
    if (leaves[dateStr]) lines.push(`🌴 ${LEAVE_TYPES[leaves[dateStr].type]} : ${leaves[dateStr].days}j`)
    return lines.join('\n')
  }

  // ---------- Statuts ----------
  const status = craSubmission?.status
  const isDraft = status === 'draft'
  const isRejected = status === 'rejected'
  const canEdit = craLoaded && !!selectedProject && (isLeaveMode || !craSubmission || isDraft || isRejected)

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
      // Existe déjà → on le récupère
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

  // Projet : retourne { id, value } ou null si supprimée
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

  // Congé : retourne { id, days, type } ou null si supprimé
  const saveLeave = async (dateStr, value, existing) => {
    if (existing && value === 0) {
      await api.delete(`/leaves/${existing.id}/`).catch((e) => {
        if (e.status !== 404) throw e
      })
      return null
    }
    if (existing) {
      await api.patch(`/leaves/${existing.id}/`, { days: value, leave_type: leaveType })
      return { id: existing.id, days: value, type: leaveType }
    }
    if (value > 0) {
      const data = await api.post('/leaves/', { date: dateStr, days: value, leave_type: leaveType })
      return { id: data.id, days: value, type: leaveType }
    }
    return null
  }

  // ---------- Actions ----------
  const handleDayClick = async (day) => {
    if (!day || isWeekend(day) || !canEdit) return
    if (getHoliday(day)) {
      showMsg('error', `${getHoliday(day)} : jour férié`)
      return
    }

    const dateStr = getDateString(day)
    const current = getProjectValue(dateStr, selectedProject)
    const others = getDayTotal(dateStr) - current
    const max = 1 - others

    if (max <= 0) {
      showMsg('error', 'Journée déjà complète (autre projet ou congé)')
      return
    }

    const cycle = [1, 0.5, 0].filter((v) => v <= max)
    const newValue = cycle[(cycle.indexOf(current) + 1) % cycle.length]

    try {
      if (isLeaveMode) {
        const saved = await saveLeave(dateStr, newValue, leaves[dateStr])
        setLeaves((prev) => {
          const next = { ...prev }
          if (saved) next[dateStr] = saved
          else delete next[dateStr]
          return next
        })
        return
      }

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
    let cra = null
    if (!isLeaveMode) {
      cra = await ensureDraft()
      if (!cra) return
    }

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
      if (isLeaveMode) {
        tasks.push(saveLeave(dateStr, value, leaves[dateStr]).then((saved) => ({ key: dateStr, saved })))
      } else {
        const k = entryKey(dateStr, selectedProject)
        tasks.push(saveEntry(cra.id, dateStr, selectedProject, value, entries[k]).then((saved) => ({ key: k, saved })))
      }
    }

    setLoading(true)
    try {
      const results = await Promise.all(tasks)
      const merge = (prev) => {
        const next = { ...prev }
        results.forEach(({ key, saved }) => {
          if (saved) next[key] = saved
        })
        return next
      }
      if (isLeaveMode) setLeaves(merge)
      else setEntries(merge)
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
      console.error(error)
      showMsg('error', error.message || 'Erreur suppression')
    }
  }

  // ---------- Stats ----------
  const days = getDaysInMonth()
  const workingDays = days.filter((d) => d && !isWeekend(d) && !getHoliday(d))
  const selectedValues = days.filter((d) => d).map((d) => getProjectValue(getDateString(d), selectedProject))
  const monthTotal = Math.round(selectedValues.reduce((s, v) => s + v, 0) * 2) / 2
  const leaveTotal = Object.values(leaves).reduce((s, l) => s + l.days, 0)
  const remaining = Math.round(
    workingDays.reduce((s, d) => s + Math.max(0, 1 - getDayTotal(getDateString(d))), 0) * 2
  ) / 2

  const handleSubmitCRA = async () => {
    if (monthTotal === 0) {
      showMsg('error', 'Remplissez au moins un jour')
      return
    }
    const p = projects.find((x) => x.id === selectedProject)
    const warn = remaining > 0
      ? `\n\n⚠️ ${remaining} jour(s) ouvré(s) du mois ne sont pas renseignés ni sur un projet ni en congé.`
      : ''
    const ok = await ask({
      title: 'Soumettre le CRA',
      message: `${monthTotal} jour(s) sur ${p?.name} pour ${monthNames[currentMonth]} ${currentYear}.${warn}\n\nAprès soumission, le CRA n'est plus modifiable sauf rejet.`,
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

  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
  const monthHolidays = Object.entries(holidays).filter(([d]) => d.startsWith(monthPrefix))
  const canSubmitMonth = isCurrentMonth || isRejected

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon CRA - Calendrier</h1>
          <p className="text-gray-600 mt-1">
            {monthNames[currentMonth]} {currentYear}
            {selectedProject && craLoaded && (
              isLeaveMode ? (
                <span className="ml-3 inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded"><IconLeave className="w-3.5 h-3.5" /> Mode congé</span>
              ) : (
                <>
                  {!craSubmission && <span className="ml-3 inline-block px-2 py-1 bg-gray-50 text-gray-500 text-xs font-medium rounded">Non commencé</span>}
                  {isDraft && <span className="ml-3 inline-block px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded">Brouillon</span>}
                  {status === 'submitted' && <span className="ml-3 inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded"><IconPending className="w-3.5 h-3.5" /> Soumis</span>}
                  {status === 'validated' && <span className="ml-3 inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded"><IconCheck className="w-3.5 h-3.5" /> Validé</span>}
                  {isRejected && <span className="ml-3 inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded"><IconX className="w-3.5 h-3.5" /> Rejeté</span>}
                </>
              )
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



      {/* Sélection projet / congé */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium mb-2">Projet</label>
              <select
                value={selectedProject || ''}
                onChange={(e) => {
                  const v = e.target.value
                  setSelectedProject(v === LEAVE ? LEAVE : v ? parseInt(v) : null)
                }}
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
                <option disabled>──────────</option>
                <option value={LEAVE}>🌴 Congé / absence{leaveTotal ? ` — ${leaveTotal}j ce mois` : ''}</option>
              </select>
            </div>

            {isLeaveMode && (
              <div className="min-w-[180px]">
                <label className="block text-sm font-medium mb-2">Type de congé</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full px-3 py-2 border border-purple-300 rounded-lg bg-purple-50"
                >
                  {Object.entries(LEAVE_TYPES).map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => setShowPeriodModal(true)}
              className={`px-4 py-2 flex items-center gap-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${isLeaveMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-salesforce-blue hover:bg-blue-700'
                }`}
              disabled={!canEdit || loading}
            >
              <IconCalendar className="w-4 h-4" /> {isLeaveMode ? 'Poser une période' : 'Remplir période'}
            </button>
            {isDraft && (
              <button onClick={handleDeleteDraft} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2">
                <IconTrash className="w-4 h-4" /> Supprimer
              </button>
            )}
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
      {craLoaded && status === 'validated' && (
        <div className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 flex items-start gap-2">
          <IconCheck className="w-5 h-5 flex-shrink-0" /> <span>CRA de ce projet validé, aucune modification possible.</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card"><div className="card-body">
          <p className="text-sm text-gray-600 mb-1">{isLeaveMode ? 'Congés posés' : 'Ce projet'}</p>
          <p className={`text-3xl font-bold ${isLeaveMode ? 'text-purple-600' : 'text-salesforce-blue'}`}>{monthTotal} j</p>
        </div></div>
        <div className="card"><div className="card-body">
          <p className="text-sm text-gray-600 mb-1">Congés du mois</p>
          <p className="text-3xl font-bold text-purple-600">{leaveTotal} j</p>
        </div></div>
        <div className="card"><div className="card-body">
          <p className="text-sm text-gray-600 mb-1">Jours ouvrés restants</p>
          <p className={`text-3xl font-bold ${remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {remaining} j
          </p>
          <p className="text-xs text-gray-500 mt-1">sur {workingDays.length} jours ouvrés (hors fériés)</p>
        </div></div>
      </div>

      {/* Légende */}
      <div className="card mb-4">
        <div className="card-body">
          <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            {!canEdit ? (
              <><IconEye className="w-4 h-4 text-gray-500" /> Calendrier en lecture seule pour ce projet</>
            ) : isLeaveMode ? (
              <><IconLeave className="w-4 h-4 text-purple-600" /> Cliquez sur une case pour poser un congé ({LEAVE_TYPES[leaveType]}) : 1j → 0.5j → vide</>
            ) : (
              <><IconEdit className="w-4 h-4 text-salesforce-blue" /> Cliquez sur une case : 1j → 0.5j → vide</>
            )}
          </p>
          <div className="flex gap-6 flex-wrap">
            <Legend cls="border-green-500 bg-green-100" label="1 jour" />
            <Legend cls="border-orange-500 bg-orange-100" label="0.5 jour" />
            <Legend cls="border-purple-400 bg-purple-100" label="Congé" />
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
              const leaveDays = getLeaveDays(dateStr)
              const own = getProjectValue(dateStr, selectedProject)
              const others = getDayTotal(dateStr) - own
              const blocked = own === 0 && others >= 1
              const isClickable = !weekend && !holiday && canEdit && !blocked

              let colorClass = 'bg-white border-gray-300'
              let textColorClass = 'text-gray-900'
              let sub = null

              if (holiday) {
                colorClass = 'bg-indigo-50 border-indigo-200'
                textColorClass = 'text-indigo-400'
                sub = 'Férié'
              } else if (isLeaveMode && own > 0) {
                colorClass = own >= 1 ? 'bg-purple-100 border-purple-500' : 'bg-purple-50 border-purple-400'
                textColorClass = 'text-purple-800'
                sub = `${own}j`
              } else if (!isLeaveMode && own === 1) {
                colorClass = 'bg-green-100 border-green-500'
                textColorClass = 'text-green-800'
                sub = '1j'
              } else if (!isLeaveMode && own === 0.5) {
                colorClass = 'bg-orange-100 border-orange-500'
                textColorClass = 'text-orange-800'
                sub = '0.5j'
              } else if (leaveDays >= 1) {
                colorClass = 'bg-purple-50 border-purple-200'
                textColorClass = 'text-purple-400'
                sub = 'Congé'
              } else if (others >= 1) {
                colorClass = 'bg-slate-200 border-slate-300'
                textColorClass = 'text-slate-500'
                sub = 'pris'
              } else if (leaveDays > 0) {
                colorClass = 'bg-purple-50 border-purple-300 border-dashed'
                textColorClass = 'text-purple-500'
                sub = '½ congé'
              } else if (others > 0) {
                colorClass = 'bg-slate-50 border-slate-300 border-dashed'
                textColorClass = 'text-slate-500'
                sub = '½ dispo'
              }

              return (
                <div
                  key={index}
                  onClick={() => handleDayClick(day)}
                  title={holiday || getDayDetail(dateStr)}
                  className={`
                    aspect-square p-1 rounded border-2 flex flex-col items-center justify-center transition-all text-sm
                    ${weekend ? 'bg-gray-100 border-gray-200 cursor-not-allowed' : colorClass}
                    ${isClickable ? 'hover:shadow-md hover:scale-105 cursor-pointer' : ''}
                    ${!weekend && !isClickable ? 'cursor-not-allowed' : ''}
                  `}
                >
                  <div className={`text-sm font-semibold ${textColorClass}`}>{day}</div>
                  {sub && <div className={`text-[9px] mt-0.5 font-medium ${textColorClass}`}>{sub}</div>}
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
            className={`px-6 py-3 bg-green-600 text-white rounded-lg font-semibold text-lg hover:bg-green-700 ${loading || !canSubmitMonth ? 'opacity-50 cursor-not-allowed' : ''
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
          isLeave={isLeaveMode}
          leaveLabel={LEAVE_TYPES[leaveType]}
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

const PeriodModal = ({ month, year, isLeave, leaveLabel, onSave, onClose }) => {
  const mm = String(month + 1).padStart(2, '0')
  const lastDay = String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')
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
            {isLeave ? <><IconLeave className="w-5 h-5 text-purple-600" /> Poser une période de congé</> : <><IconCalendar className="w-5 h-5 text-salesforce-blue" /> Remplir une période</>}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {isLeave ? `Chaque jour ouvré = 1 jour de ${leaveLabel.toLowerCase()}` : 'Chaque jour ouvré = 1 jour sur le projet sélectionné'}
          </p>
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
          {error && <Alert severity="error">{error}</Alert>}
        </div>
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3 flex items-center gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Annuler</button>
          <button
            onClick={handleSave}
            className={`px-4 py-2 text-white rounded-lg ${isLeave ? 'bg-purple-600 hover:bg-purple-700' : 'bg-salesforce-blue hover:bg-blue-700'}`}
          >
            <IconCheck className="w-4 h-4" /> {isLeave ? 'Poser' : 'Remplir'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SubmitCRA