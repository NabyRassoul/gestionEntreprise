import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'
import { submitCRA } from '../services/n8n'

const SubmitCRA = () => {
  const { user } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [projects, setProjects] = useState([])
  const [dayValues, setDayValues] = useState({})
  const [selectedProject, setSelectedProject] = useState(null)
  const [craSubmission, setCraSubmission] = useState(null)
  const [showPeriodModal, setShowPeriodModal] = useState(false)
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  const dayNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

  // ✅ MODIFICATION 1 : Vérifier si c'est le mois courant
  const today = new Date()
  const isCurrentMonth = currentMonth === today.getMonth() && currentYear === today.getFullYear()

  useEffect(() => {
    loadProjects()
    loadCRAData()
  }, [currentMonth, currentYear, user])

  const loadProjects = async () => {
    const { data } = await supabase
      .from('project_assignments')
      .select('project:projects(*)')
      .eq('user_id', user.id)
    
    if (data) {
      const projectsList = data.map(pa => pa.project).filter(Boolean)
      setProjects(projectsList)
      if (projectsList.length > 0 && !selectedProject) {
        setSelectedProject(projectsList[0].id)
      }
    }
  }

  const loadCRAData = async () => {
    // Utiliser maybeSingle() au lieu de single() pour éviter l'erreur 406
    const { data: existingCRA } = await supabase
      .from('cra_submissions')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth + 1)
      .eq('year', currentYear)
      .maybeSingle() // ← Ne retourne pas d'erreur si aucun résultat

    if (existingCRA) {
      setCraSubmission(existingCRA)
      
      const { data: entries } = await supabase
        .from('cra_entries')
        .select('*')
        .eq('cra_submission_id', existingCRA.id)

      if (entries && entries.length > 0) {
        const values = {}
        entries.forEach(entry => {
          values[entry.work_date] = parseFloat(entry.days_worked)
        })
        setDayValues(values)
      } else {
        setDayValues({})
      }
    } else {
      setCraSubmission(null)
      setDayValues({})
    }
  }

  // ✅ MODIFICATION 2 : Réactiver un CRA rejeté en draft
  const handleReactivateRejected = async () => {
    if (!confirm('Voulez-vous refaire ce CRA ? Il sera remis en brouillon.')) return

    try {
      // Supprimer les anciennes entrées
      await supabase
        .from('cra_entries')
        .delete()
        .eq('cra_submission_id', craSubmission.id)

      // Remettre en draft
      const { error } = await supabase
        .from('cra_submissions')
        .update({
          status: 'draft',
          rejection_reason: null,
          submitted_at: null,
          validated_at: null,
          validated_by: null
        })
        .eq('id', craSubmission.id)

      if (error) throw error

      // Recharger depuis la base pour avoir l'état à jour
      setDayValues({})
      setMessage({ type: 'success', text: 'CRA remis en brouillon. Vous pouvez le refaire !' })
      setTimeout(() => setMessage(null), 3000)
      
      // Recharger toutes les données
      await loadCRAData()

    } catch (error) {
      console.error('Erreur:', error)
      setMessage({ type: 'error', text: 'Erreur lors de la réactivation : ' + error.message })
    }
  }

  const getDaysInMonth = () => {
    const firstDay = new Date(currentYear, currentMonth, 1)
    const lastDay = new Date(currentYear, currentMonth + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = (firstDay.getDay() + 6) % 7

    const days = []
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null)
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day)
    }
    return days
  }

  const isWeekend = (day) => {
    if (!day) return false
    const date = new Date(currentYear, currentMonth, day)
    const dayOfWeek = date.getDay()
    return dayOfWeek === 0 || dayOfWeek === 6
  }

  const getDateString = (day) => {
    if (!day) return null
    const month = String(currentMonth + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    return `${currentYear}-${month}-${dayStr}`
  }

  const getDayValue = (day) => {
    const dateStr = getDateString(day)
    return dayValues[dateStr] || 0
  }

  const getMonthTotal = () => {
    const total = Object.values(dayValues).reduce((sum, val) => sum + val, 0)
    return Math.round(total * 2) / 2
  }

  const handleDayClick = async (day) => {
    if (!day || isWeekend(day) || !selectedProject || !craSubmission || craSubmission?.status !== 'draft') return

    const dateStr = getDateString(day)
    const currentValue = dayValues[dateStr] || 0

    let newValue
    if (currentValue === 0) newValue = 1
    else if (currentValue === 1) newValue = 0.5
    else newValue = 0

    const newDayValues = { ...dayValues }
    if (newValue === 0) {
      delete newDayValues[dateStr]
    } else {
      newDayValues[dateStr] = newValue
    }
    setDayValues(newDayValues)
    await saveDayValue(dateStr, newValue)
  }

  const saveDayValue = async (dateStr, value, craId = null) => {
    const currentCRA = craId || craSubmission?.id
    if (!currentCRA || !selectedProject) return

    await supabase
      .from('cra_entries')
      .delete()
      .eq('cra_submission_id', currentCRA)
      .eq('work_date', dateStr)

    if (value > 0) {
      await supabase
        .from('cra_entries')
        .insert([{
          cra_submission_id: currentCRA,
          project_id: selectedProject,
          work_date: dateStr,
          days_worked: value,
          description: ''
        }])
    }
  }

  const fillPeriod = async (startDate, endDate) => {
    if (!selectedProject) {
      setMessage({ type: 'error', text: 'Sélectionnez un projet d\'abord' })
      return
    }

    let currentCRA = craSubmission
    if (!currentCRA) {
      const { data: newCRA } = await supabase
        .from('cra_submissions')
        .insert([{
          user_id: user.id,
          month: currentMonth + 1,
          year: currentYear,
          status: 'draft'
        }])
        .select()
        .single()

      if (newCRA) {
        currentCRA = newCRA
        setCraSubmission(newCRA)
      } else {
        setMessage({ type: 'error', text: 'Erreur lors de la création du CRA' })
        return
      }
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    const newDayValues = { ...dayValues }

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDate()
      const month = d.getMonth()
      const year = d.getFullYear()

      if (month === currentMonth && year === currentYear) {
        if (!isWeekend(day)) {
          const dateStr = getDateString(day)
          newDayValues[dateStr] = 1
          await saveDayValue(dateStr, 1, currentCRA.id)
        }
      }
    }

    setDayValues(newDayValues)
    setMessage({ type: 'success', text: 'Période remplie !' })
    setTimeout(() => setMessage(null), 2000)
  }

  const handleDeleteDraft = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce brouillon ?')) return

    if (craSubmission) {
      await supabase.from('cra_entries').delete().eq('cra_submission_id', craSubmission.id)
      await supabase.from('cra_submissions').delete().eq('id', craSubmission.id)

      setDayValues({})
      setCraSubmission(null)
      setMessage({ type: 'success', text: 'Brouillon supprimé' })
      setTimeout(() => setMessage(null), 2000)
      await loadCRAData()
    }
  }

  const handleSubmitCRA = async () => {
    if (getMonthTotal() === 0) {
      setMessage({ type: 'error', text: 'Vous devez remplir au moins un jour' })
      return
    }

    if (!confirm('Êtes-vous sûr de vouloir soumettre ce CRA ? Vous ne pourrez plus le modifier.')) return

    setLoading(true)

    const projectDays = {}
    Object.entries(dayValues).forEach(([date, value]) => {
      if (!projectDays[selectedProject]) projectDays[selectedProject] = 0
      projectDays[selectedProject] += value
    })

    const entries = Object.entries(projectDays).map(([project_id, days]) => ({
      project_id,
      days_worked: days,
      description: `Total: ${days} jours`
    }))

    const result = await submitCRA({
      user_id: user.id,
      month: currentMonth + 1,
      year: currentYear,
      entries
    })

    if (result.success) {
      setMessage({ type: 'success', text: 'CRA soumis avec succès !' })
      await loadCRAData()
    } else {
      setMessage({ type: 'error', text: 'Erreur lors de la soumission' })
    }

    setLoading(false)
  }

  const days = getDaysInMonth()

  // ✅ MODIFICATION 3 : Déterminer si le calendrier est en lecture seule
  const isReadOnly = craSubmission?.status === 'validated' || craSubmission?.status === 'submitted'
  const isDraft = craSubmission?.status === 'draft'
  const isRejected = craSubmission?.status === 'rejected'

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon CRA - Calendrier</h1>
          <p className="text-gray-600 mt-1">
            {monthNames[currentMonth]} {currentYear}
            {isDraft && <span className="ml-3 badge badge-gray">Brouillon</span>}
            {craSubmission?.status === 'submitted' && <span className="ml-3 badge badge-yellow">⏳ Soumis</span>}
            {craSubmission?.status === 'validated' && <span className="ml-3 badge badge-green">✅ Validé</span>}
            {isRejected && <span className="ml-3 badge badge-red">❌ Rejeté</span>}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1) }
              else setCurrentMonth(currentMonth - 1)
            }}
            className="btn-secondary"
          >
            ◀ Mois précédent
          </button>
          <button
            onClick={() => {
              if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1) }
              else setCurrentMonth(currentMonth + 1)
            }}
            className="btn-secondary"
          >
            Mois suivant ▶
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* ✅ MODIFICATION 2 : Bannière CRA Rejeté */}
      {isRejected && (
        <div className="card mb-6 border-l-4 border-l-red-500">
          <div className="card-body">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-red-900 mb-1">❌ CRA Rejeté</h3>
                {craSubmission?.rejection_reason && (
                  <p className="text-sm text-red-700">
                    Raison : {craSubmission.rejection_reason}
                  </p>
                )}
              </div>
              {isCurrentMonth && (
                <button
                  onClick={handleReactivateRejected}
                  className="btn-primary"
                >
                  🔄 Refaire ce CRA
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ✅ MODIFICATION 3 : Bannière CRA Validé (lecture seule) */}
      {craSubmission?.status === 'validated' && (
        <div className="card mb-6 border-l-4 border-l-green-500">
          <div className="card-body">
            <p className="text-sm text-green-800">
              ✅ Ce CRA a été validé. Le calendrier est en lecture seule — les couleurs reflètent vos jours travaillés.
            </p>
          </div>
        </div>
      )}

      {/* Actions rapides - seulement en draft */}
      {(!craSubmission || isDraft) && (
        <div className="card mb-6">
          <div className="card-body">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="label-salesforce">Projet</label>
                <select
                  value={selectedProject || ''}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="input-salesforce"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setShowPeriodModal(true)}
                className="btn-primary"
                disabled={!selectedProject}
              >
                {craSubmission ? '📝 Modifier la période' : '📅 Remplir une période'}
              </button>
              {craSubmission && (
                <button onClick={handleDeleteDraft} className="btn-danger">
                  🗑️ Supprimer brouillon
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-600 mb-1">Total jours</p>
            <p className="text-3xl font-bold text-salesforce-blue">{getMonthTotal()}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-600 mb-1">Jours complets</p>
            <p className="text-3xl font-bold text-green-600">
              {Object.values(dayValues).filter(v => v === 1).length}
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-600 mb-1">Demi-journées</p>
            <p className="text-3xl font-bold text-orange-600">
              {Object.values(dayValues).filter(v => v === 0.5).length}
            </p>
          </div>
        </div>
      </div>

      {/* Légende */}
      <div className="card mb-4">
        <div className="card-body">
          {isDraft && (
            <p className="text-sm font-semibold text-gray-700 mb-3">
              💡 Cliquez sur une case pour changer : 1j (vert) → 0.5j (orange) → Vide (blanc)
            </p>
          )}
          {isReadOnly && (
            <p className="text-sm font-semibold text-gray-700 mb-3">
              👁️ Calendrier en lecture seule
            </p>
          )}
          <div className="flex gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded border-2 border-green-500 bg-green-100"></div>
              <span className="text-sm text-gray-700">1 jour</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded border-2 border-orange-500 bg-orange-100"></div>
              <span className="text-sm text-gray-700">0.5 jour</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded border-2 border-gray-300 bg-white"></div>
              <span className="text-sm text-gray-700">Non travaillé</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendrier */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="grid grid-cols-7 gap-1 max-w-2xl mx-auto">
            {dayNames.map((name, i) => (
              <div key={i} className="text-center text-sm font-semibold text-gray-600 py-2">
                {name}
              </div>
            ))}

            {days.map((day, index) => {
              const value = getDayValue(day)
              const weekend = isWeekend(day)
              // ✅ Cliquable seulement en draft
              const isClickable = day && !weekend && isDraft && selectedProject

              let colorClass = 'bg-white'
              let borderClass = 'border-gray-300'
              let textColorClass = 'text-gray-900'
              
              if (value === 1) {
                colorClass = 'bg-green-100'
                borderClass = 'border-green-500'
                textColorClass = 'text-green-800'
              } else if (value === 0.5) {
                colorClass = 'bg-orange-100'
                borderClass = 'border-orange-500'
                textColorClass = 'text-orange-800'
              }

              return (
                <div
                  key={index}
                  onClick={() => handleDayClick(day)}
                  className={`
                    aspect-square p-1 rounded border-2 flex flex-col items-center justify-center transition-all text-sm
                    ${!day ? 'invisible' : ''}
                    ${weekend ? 'bg-gray-100 border-gray-200 cursor-not-allowed' : ''}
                    ${!weekend && day ? `${colorClass} ${borderClass}` : ''}
                    ${isClickable ? 'hover:shadow-md hover:scale-105 cursor-pointer' : ''}
                    ${!isClickable && !weekend && day ? 'cursor-not-allowed' : ''}
                  `}
                >
                  {day && (
                    <>
                      <div className={`text-sm font-semibold ${value > 0 ? textColorClass : 'text-gray-900'}`}>
                        {day}
                      </div>
                      {value > 0 && (
                        <div className={`text-[10px] font-bold mt-0.5 ${textColorClass}`}>
                          {value}j
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ✅ MODIFICATION 1 : Bouton soumettre uniquement mois courant */}
      {isDraft && getMonthTotal() > 0 && (
        <div className="flex justify-end items-center gap-4">
          {!isCurrentMonth && (
            <p className="text-sm text-orange-600">
              ⚠️ Soumission possible uniquement pour le mois en cours
            </p>
          )}
          <button
            onClick={handleSubmitCRA}
            disabled={loading || !isCurrentMonth}
            className={`btn-primary text-lg px-8 py-3 ${!isCurrentMonth ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? '⏳ Soumission...' : '📤 Soumettre mon CRA'}
          </button>
        </div>
      )}

      {/* Modal période */}
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

// Modal de remplissage par période
const PeriodModal = ({ month, year, onSave, onClose }) => {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const lastDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    setStartDate(firstDay)
    setEndDate(lastDayStr)
  }, [month, year])

  const handleSave = () => {
    if (!startDate || !endDate) { alert('Veuillez remplir les deux dates'); return }
    if (new Date(startDate) > new Date(endDate)) { alert('La date de début doit être avant la date de fin'); return }
    onSave(startDate, endDate)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900">Remplir une période</h2>
          <p className="text-sm text-gray-600 mt-1">Toutes les dates seront remplies à 1 jour (vert)</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="label-salesforce">Date de début</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-salesforce" />
          </div>
          <div>
            <label className="label-salesforce">Date de fin</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-salesforce" />
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
            💡 Les weekends seront automatiquement ignorés
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={handleSave} className="btn-primary">✅ Remplir</button>
        </div>
      </div>
    </div>
  )
}

export default SubmitCRA