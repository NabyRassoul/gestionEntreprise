import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import api from '../api'
import { useFeedback } from '../contexts/FeedbackContext'
import { IconLeave, IconHome, IconSave, IconSettings, IconPlus, IconMinus } from '../components/Icons'

const toNum = (v) => (v === '' || v === null || v === undefined ? '' : Number(v))
const fmt = (v) => String(v).replace('.', ',')

const LeaveSettings = () => {
  const { notify, confirm: ask } = useFeedback()
  const [saved, setSaved] = useState(null)       // valeurs enregistrées
  const [form, setForm] = useState({ cp: '', tt: '' })
  const [updatedAt, setUpdatedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const p = await api.get('/leave-policy/')
      const values = { cp: toNum(p.cp_days_per_year), tt: toNum(p.tt_days_per_year) }
      setSaved(values)
      setForm(values)
      setUpdatedAt(p.updated_at)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const invalid = (v) => v === '' || isNaN(v) || v < 0 || v > 366 || (v * 2) % 1 !== 0
  const dirty = saved && (form.cp !== saved.cp || form.tt !== saved.tt)
  const hasError = invalid(form.cp) || invalid(form.tt)

  const step = (key, delta) =>
    setForm((f) => ({ ...f, [key]: Math.min(366, Math.max(0, (Number(f[key]) || 0) + delta)) }))

  const handleSave = async () => {
    setError(null)
    if (hasError) return setError('Les quotas doivent être compris entre 0 et 366 jours (par pas de 0,5).')

    const changes = []
    if (form.cp !== saved.cp) changes.push(`CP : ${fmt(saved.cp)} → ${fmt(form.cp)} j/an`)
    if (form.tt !== saved.tt) changes.push(`TT : ${fmt(saved.tt)} → ${fmt(form.tt)} j/an`)

    const ok = await ask({
      title: 'Modifier les quotas',
      message:
        `${changes.join('\n')}\n\n` +
        `Le changement s'applique immédiatement à TOUS les collaborateurs, managers et admins, ` +
        `y compris au calcul du report de CP de l'année précédente.`,
      confirmText: 'Enregistrer',
      severity: 'warning',
    })
    if (!ok) return

    setSaving(true)
    try {
      const p = await api.patch('/leave-policy/', { cp_days_per_year: form.cp, tt_days_per_year: form.tt })
      const values = { cp: toNum(p.cp_days_per_year), tt: toNum(p.tt_days_per_year) }
      setSaved(values)
      setForm(values)
      setUpdatedAt(p.updated_at)
      notify('success', 'Quotas mis à jour')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-salesforce-blue text-white flex items-center justify-center">
          <IconSettings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres des absences</h1>
          <p className="text-gray-600 text-sm">Quotas annuels identiques pour toutes les personnes</p>
        </div>
      </div>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <QuotaCard
          icon={IconLeave}
          accent="purple"
          title="Congés payés (CP)"
          value={form.cp}
          saved={saved?.cp}
          invalid={invalid(form.cp)}
          onChange={(v) => setForm((f) => ({ ...f, cp: toNum(v) }))}
          onStep={(d) => step('cp', d)}
          rules={[
            'Attribués à chaque personne au 1er janvier.',
            "Les jours non pris sont reportés sur l'année suivante, puis expirent au 31 décembre de celle-ci (validité 2 ans).",
            'Les plus anciens sont consommés en premier.',
            'Une demande en attente réserve déjà les jours.',
          ]}
        />
        <QuotaCard
          icon={IconHome}
          accent="blue"
          title="Télétravail (TT)"
          value={form.tt}
          saved={saved?.tt}
          invalid={invalid(form.tt)}
          onChange={(v) => setForm((f) => ({ ...f, tt: toNum(v) }))}
          onStep={(d) => step('tt', d)}
          rules={[
            'Remis à zéro chaque 1er janvier.',
            'Les jours non utilisés expirent au 31 décembre (pas de report).',
            'Un jour de TT reste saisissable dans le CRA.',
            'Une demande en attente réserve déjà les jours.',
          ]}
        />
      </div>

      <Alert severity="info" sx={{ mt: 3 }}>
        Les autres absences (maladie, mariage, baptême, décès…) n'ont pas de quota : elles sont simplement soumises à validation.
      </Alert>

      {/* Barre d'enregistrement */}
      <div className="mt-6 flex items-center justify-between gap-4 bg-white rounded-lg border border-gray-200 shadow-sm px-5 py-3">
        <p className="text-xs text-gray-500">
          {updatedAt
            ? `Dernière modification le ${new Date(updatedAt).toLocaleDateString('fr-FR')} à ${new Date(updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
            : 'Valeurs par défaut'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => saved && setForm(saved)}
            disabled={!dirty || saving}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || hasError || saving}
            className="px-4 py-2 bg-salesforce-blue text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <IconSave className="w-4 h-4" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

const ACCENTS = {
  purple: { badge: 'bg-purple-50 text-purple-700', ring: 'focus:ring-purple-500', dot: 'bg-purple-400' },
  blue: { badge: 'bg-blue-50 text-salesforce-blue', ring: 'focus:ring-blue-500', dot: 'bg-blue-400' },
}

const QuotaCard = ({ icon: Icon, accent, title, value, saved, invalid, onChange, onStep, rules }) => {
  const a = ACCENTS[accent]
  const changed = saved !== undefined && value !== saved
  return (
    <div className={`bg-white rounded-lg border shadow-sm overflow-hidden ${changed ? 'border-salesforce-blue' : 'border-gray-200'}`}>
      <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`w-8 h-8 rounded flex items-center justify-center ${a.badge}`}>
            <Icon className="w-4 h-4" />
          </span>
          <h2 className="font-semibold text-gray-900">{title}</h2>
        </div>
        {changed && <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-salesforce-blue">Modifié</span>}
      </div>

      <div className="p-5">
        <label className="block text-sm text-gray-600 mb-2">Jours par an et par personne</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onStep(-1)}
            className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50"
            title="−1 jour"
          >
            <IconMinus className="w-4 h-4" />
          </button>
          <input
            type="number"
            min="0"
            max="366"
            step="0.5"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-28 text-center text-3xl font-bold px-2 py-1.5 border rounded-lg focus:outline-none focus:ring-2 ${a.ring} ${
              invalid ? 'border-red-400 text-red-600' : 'border-gray-300 text-gray-900'
            }`}
          />
          <button
            type="button"
            onClick={() => onStep(1)}
            className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50"
            title="+1 jour"
          >
            <IconPlus className="w-4 h-4" />
          </button>
          <span className="text-gray-500 ml-1">j / an</span>
        </div>
        {changed && saved !== undefined && (
          <p className="text-xs text-gray-500 mt-2">Valeur actuelle : {fmt(saved)} j</p>
        )}

        <ul className="mt-5 space-y-1.5">
          {rules.map((r) => (
            <li key={r} className="text-xs text-gray-600 flex gap-2">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${a.dot}`} />
              {r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default LeaveSettings