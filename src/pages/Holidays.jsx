import { useState, useEffect } from 'react'
import api from '../api'
import { useAuth } from '../contexts/AuthContext'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import { useFeedback } from '../contexts/FeedbackContext'
import { IconChevronLeft, IconChevronRight, IconPlus, IconCalendar, IconPencil, IconTrash } from '../components/Icons'
const SUGGESTIONS = ['Tamkharit', 'Korité', 'Tabaski', 'Maouloud (Gamou)', 'Magal de Touba']

const Holidays = () => {
  const { token, user } = useAuth()
  
  const isAdmin = user?.role === 'admin'

  const [year, setYear] = useState(new Date().getFullYear())
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [modal, setModal] = useState({ open: false, holiday: null, label: '' })

    const { notify, confirm: ask } = useFeedback()
  const showMsg = (type, text) => notify(type, text)

  useEffect(() => {
    if (token) load()
  }, [token, year])

    const load = async () => {
    setLoading(true)
    try {
      const list = await api.list('/holidays/', { year })
      setHolidays(list.sort((a, b) => a.date.localeCompare(b.date)))
    } catch (e) {
      showMsg('error', e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (form, holiday) => {
    try {
      if (holiday) await api.patch(`/holidays/${holiday.id}/`, form)
      else await api.post('/holidays/', form)
    } catch (e) {
      return e.data?.date ? 'Un jour férié existe déjà à cette date' : e.message
    }
    setModal({ open: false, holiday: null, label: '' })
    showMsg('success', holiday ? 'Jour férié modifié' : 'Jour férié ajouté')
    await load()
    return null
  }

  const handleDelete = async (h) => {
    const ok = await ask({
      title: 'Supprimer le jour férié',
      message: `« ${h.label} » du ${new Date(h.date).toLocaleDateString('fr-FR')} ne sera plus bloqué dans les CRA.`,
      confirmText: 'Supprimer',
      severity: 'error',
    })
    if (!ok) return
    try {
      await api.delete(`/holidays/${h.id}/`)
      setHolidays((prev) => prev.filter((x) => x.id !== h.id))
      showMsg('success', 'Jour férié supprimé')
    } catch (e) {
      showMsg('error', e.message)
    }
  }

  const missing = SUGGESTIONS.filter(
    (s) => !holidays.some((h) => h.label.toLowerCase().includes(s.split(' ')[0].toLowerCase()))
  )

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Jours fériés</h1>
          <p className="text-gray-600">Ces jours sont bloqués dans la saisie des CRA</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-gray-300 rounded-lg bg-white">
            <button onClick={() => setYear(year - 1)} className="px-3 py-2 hover:bg-gray-50 rounded-l-lg"><IconChevronLeft className="w-4 h-4" /></button>
            <span className="px-4 py-2 font-semibold text-gray-900 border-x border-gray-300">{year}</span>
            <button onClick={() => setYear(year + 1)} className="px-3 py-2 hover:bg-gray-50 rounded-r-lg"><IconChevronRight className="w-4 h-4" /></button>
          </div>
          {isAdmin && (
            <button
              onClick={() => setModal({ open: true, holiday: null, label: '' })}
              className="px-4 py-2 bg-salesforce-blue text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <IconPlus className="w-4 h-4" /> Ajouter
            </button>
          )}
        </div>
      </div>

      

            {/* Fêtes lunaires manquantes */}
      {isAdmin && !loading && missing.length > 0 && (
        <Alert severity="info" icon={<IconCalendar />} sx={{ mb: 3 }}>
          <AlertTitle>Fêtes à date variable à renseigner pour {year}</AlertTitle>
          Leur date dépend du calendrier lunaire : ajoutez-les dès qu'elles sont officialisées.
          <div className="flex flex-wrap gap-2 mt-3">
            {missing.map((s) => (
              <button
                key={s}
                onClick={() => setModal({ open: true, holiday: null, label: s })}
                className="px-3 py-1 text-xs font-medium rounded-full border border-blue-300 text-blue-800 bg-white hover:bg-blue-50 inline-flex items-center gap-1"
              >
                <IconPlus className="w-3 h-3" /> {s}
              </button>
            ))}
          </div>
        </Alert>
      )}
      {/* Tableau */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Calendrier {year}</h2>
          <p className="text-xs text-gray-500">{holidays.length} jour(s) férié(s)</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-600">Date</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-600">Libellé</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-600">Type</th>
                {isAdmin && <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {holidays.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-4 py-10 text-center text-gray-500">Aucun jour férié</td>
                </tr>
              )}
              {holidays.map((h) => {
                const d = new Date(h.date)
                const weekend = [0, 6].includes(d.getDay())
                const past = d < new Date(new Date().toDateString())
                return (
                  <tr key={h.id} className={`border-b border-gray-100 hover:bg-blue-50/40 ${past ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-gray-900 capitalize">
                        {d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </span>
                      {weekend && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">week-end</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-900">{h.label}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        h.is_auto ? 'bg-blue-50 text-salesforce-blue border-blue-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                        {h.is_auto ? 'Officiel (auto)' : 'Ajouté'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setModal({ open: true, holiday: h, label: h.label })}
                            className="px-3 py-1 text-xs font-medium border border-gray-300 text-gray-700 rounded hover:bg-gray-50 inline-flex items-center gap-1"
                          >
                            <IconPencil className="w-3.5 h-3.5" /> Modifier
                          </button>
                          <button
                            onClick={() => handleDelete(h)}
                            className="px-3 py-1 text-xs font-medium border border-red-300 text-red-700 rounded hover:bg-red-50 inline-flex items-center gap-1"
                          >
                           <IconTrash className="w-3.5 h-3.5" /> Supprimer
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal.open && (
        <HolidayModal
          year={year}
          holiday={modal.holiday}
          initialLabel={modal.label}
          onSave={handleSave}
          onClose={() => setModal({ open: false, holiday: null, label: '' })}
        />
      )}
    </div>
  )
}

const HolidayModal = ({ year, holiday, initialLabel, onSave, onClose }) => {
  const [date, setDate] = useState(holiday?.date || '')
  const [label, setLabel] = useState(initialLabel || '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!date || !label.trim()) return setError('La date et le libellé sont obligatoires')
    setSaving(true)
    const err = await onSave({ date, label: label.trim() }, holiday)
    setSaving(false)
    if (err) setError(err)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{holiday ? 'Modifier le jour férié' : 'Ajouter un jour férié'}</h2>
        </div>
        <form onSubmit={submit}>
          <div className="p-6 space-y-4">
                       {error && <Alert severity="error">{error}</Alert>}
            <div>
              <label className="block text-sm font-medium mb-1">Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={date}
                min={`${year}-01-01`}
                max={`${year}-12-31`}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Libellé <span className="text-red-500">*</span></label>
              <input
                list="holiday-suggestions"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Ex. : Magal de Touba"
              />
              <datalist id="holiday-suggestions">
                {SUGGESTIONS.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>
          <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Annuler</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-salesforce-blue text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Enregistrement...' : holiday ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Holidays