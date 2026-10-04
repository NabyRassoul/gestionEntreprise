import { useState, useEffect, useMemo, useRef } from 'react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import api from '../api'
import { useFeedback } from '../contexts/FeedbackContext'
import {
  IconLeave, IconHome, IconPlus, IconClose, IconCalendar, IconChevronLeft, IconChevronRight,
  IconInbox, IconSend, IconPending, IconRefresh,
} from '../components/Icons'

// ---------- Styles ----------
const TYPE_STYLES = {
  cp: 'bg-purple-100 text-purple-800 border-purple-300',
  tt: 'bg-blue-100 text-blue-800 border-blue-300',
  maladie: 'bg-rose-100 text-rose-800 border-rose-300',
  mariage: 'bg-pink-100 text-pink-800 border-pink-300',
  bapteme: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  deces: 'bg-gray-200 text-gray-800 border-gray-400',
  autre: 'bg-slate-100 text-slate-700 border-slate-300',
}
const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  approved: 'bg-green-100 text-green-800 border-green-300',
  rejected: 'bg-red-100 text-red-800 border-red-300',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-300',
}
const PERIOD_LABELS = { full: 'Journée', am: 'Matin', pm: 'Après-midi' }

const fmtNum = (v) => String(Math.round(Number(v) * 10) / 10).replace('.', ',')
const fmtDate = (d, opts = { day: '2-digit', month: 'short', year: 'numeric' }) => new Date(d).toLocaleDateString('fr-FR', opts)
const todayStr = () => new Date().toISOString().slice(0, 10)

const periodLabel = (r) => {
  const short = { day: '2-digit', month: 'short' }
  if (r.start_date === r.end_date) {
    return `${fmtDate(r.start_date)}${r.start_period !== 'full' ? ` · ${PERIOD_LABELS[r.start_period].toLowerCase()}` : ''}`
  }
  return `${fmtDate(r.start_date, short)}${r.start_period === 'pm' ? ' (ap.-midi)' : ''} → ${fmtDate(r.end_date)}${r.end_period === 'am' ? ' (matin)' : ''}`
}

// =============================================================
const MyLeaves = () => {
  const { notify, confirm: ask } = useFeedback()
  const [year, setYear] = useState(new Date().getFullYear())
  const [types, setTypes] = useState([])
  const [balance, setBalance] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '', type: '' })
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    api.list('/leave-requests/types/').then(setTypes).catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [year])

  const load = async () => {
    setLoading(true)
    try {
      const [b, list] = await Promise.all([
        api.get('/leave-requests/balances/', { year }),
        api.list('/leave-requests/', { mine: 1, year }),
      ])
      setBalance(b)
      setRequests(list)
    } catch (e) {
      notify('error', e.message)
    } finally {
      setLoading(false)
    }
  }

  const typeLabel = (key) => types.find((t) => t.key === key)?.label || key

  const otherDays = useMemo(
    () => requests.filter((r) => r.status === 'approved' && !['cp', 'tt'].includes(r.leave_type)).reduce((s, r) => s + Number(r.days), 0),
    [requests]
  )

   const rows = requests.filter(
    (r) =>
      (filters.status ? r.status === filters.status : r.status !== 'cancelled') &&
      (!filters.type || r.leave_type === filters.type)
  )
  const hiddenCancelled = !filters.status ? requests.filter((r) => r.status === 'cancelled').length : 0
  const pendingCount = requests.filter((r) => r.status === 'pending').length

  const canCancel = (r) => r.status === 'pending' || (r.status === 'approved' && r.start_date > todayStr())

    const handleCancel = async (r) => {
    const pending = r.status === 'pending'
    const ok = await ask({
      title: pending ? 'Retirer la demande' : "Annuler l'absence",
      message:
        `${typeLabel(r.leave_type)} · ${periodLabel(r)} · ${fmtNum(r.days)} j\n\n` +
        (pending
          ? 'La demande sera supprimée et votre manager en sera informé.'
          : 'Cette absence est déjà validée : les jours seront rendus à votre solde, et votre manager sera prévenu.'),
      confirmText: pending ? 'Retirer' : "Annuler l'absence",
      cancelText: 'Retour',
      severity: 'warning',
    })
    if (!ok) return
    try {
      await api.post(`/leave-requests/${r.id}/cancel/`)
      notify('success', pending ? 'Demande retirée' : 'Absence annulée, jours rendus au solde')
      load()
    } catch (e) {
      notify('error', e.message)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Mes absences</h1>
          <p className="text-gray-600">Congés, télétravail et absences : demandes et soldes</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-gray-300 rounded-lg bg-white">
            <button onClick={() => setYear(year - 1)} className="px-3 py-2 hover:bg-gray-50 rounded-l-lg"><IconChevronLeft className="w-4 h-4" /></button>
            <span className="px-4 py-2 font-semibold text-gray-900 border-x border-gray-300">{year}</span>
            <button onClick={() => setYear(year + 1)} className="px-3 py-2 hover:bg-gray-50 rounded-r-lg"><IconChevronRight className="w-4 h-4" /></button>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-salesforce-blue text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <IconPlus className="w-4 h-4" /> Nouvelle demande
          </button>
        </div>
      </div>

      {pendingCount > 0 && (
        <Alert severity="info" icon={<IconPending />} sx={{ mb: 3 }}>
          {pendingCount} demande{pendingCount > 1 ? 's' : ''} en attente de validation par votre manager.
        </Alert>
      )}

      {/* Soldes */}
      {balance && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <BalanceCard
            icon={IconLeave}
            color="purple"
            title="Congés payés (CP)"
            available={balance.cp.available}
            used={balance.cp.taken}
            pending={balance.cp.pending}
            total={balance.cp.taken + balance.cp.pending + balance.cp.available}
            details={[
              ...(balance.cp.carry_over > 0
                ? [[`Report ${year - 1}`, `${fmtNum(balance.cp.carry_over)} j · expire le ${fmtDate(balance.cp.carry_over_expires, { day: '2-digit', month: '2-digit', year: 'numeric' })}`, true]]
                : []),
              [`Acquis ${year}`, `${fmtNum(balance.cp.current)} j disponibles (quota ${fmtNum(balance.cp.quota)})`],
              ['Pris', `${fmtNum(balance.cp.taken)} j`],
              ['En attente', `${fmtNum(balance.cp.pending)} j`],
            ]}
          />
          <BalanceCard
            icon={IconHome}
            color="blue"
            title="Télétravail (TT)"
            available={balance.tt.available}
            used={balance.tt.taken}
            pending={balance.tt.pending}
            total={balance.tt.quota}
            details={[
              ['Quota annuel', `${fmtNum(balance.tt.quota)} j · expire le 31/12/${year}`],
              ['Utilisés', `${fmtNum(balance.tt.taken)} j`],
              ['En attente', `${fmtNum(balance.tt.pending)} j`],
            ]}
          />
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-9 h-9 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
                <IconCalendar className="w-5 h-5" />
              </span>
              <p className="font-semibold text-gray-900">Autres absences</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{fmtNum(otherDays)} <span className="text-base font-medium text-gray-500">j en {year}</span></p>
            <p className="text-xs text-gray-500 mt-2">Maladie, mariage, baptême, décès… : sans quota, soumises à validation.</p>
          </div>
        </div>
      )}

      {/* Tableau des demandes */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">Mes demandes {year}</h2>
            <p className="text-xs text-gray-500">{rows.length} élément{rows.length > 1 ? 's' : ''}</p>
                        {hiddenCancelled > 0 && (
              <button
                onClick={() => setFilters({ ...filters, status: 'cancelled' })}
                className="text-xs text-gray-400 hover:text-salesforce-blue hover:underline"
              >
                {hiddenCancelled} annulée{hiddenCancelled > 1 ? 's' : ''} masquée{hiddenCancelled > 1 ? 's' : ''}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className="px-3 py-1.5 text-sm border border-gray-300 rounded">
              <option value="">Tous les types</option>
              {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="px-3 py-1.5 text-sm border border-gray-300 rounded">
              <option value="">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="approved">Validée</option>
              <option value="rejected">Refusée</option>
              <option value="cancelled">Annulée</option>
            </select>
            <button onClick={load} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1.5">
              <IconRefresh className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Type', 'Période', 'Jours', 'Statut', 'Traitement', ''].map((h, i) => (
                  <th key={i} className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600 ${i === 2 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="6" className="px-4 py-10 text-center text-gray-500">Chargement...</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-gray-500">
                    <IconInbox className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    Aucune demande
                  </td>
                </tr>
              )}
              {!loading && rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-blue-50/40 align-top">
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${TYPE_STYLES[r.leave_type]}`}>
                      {r.leave_type_label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{periodLabel(r)}</div>
                    {r.description && <div className="text-xs text-gray-500 mt-0.5 max-w-xs truncate" title={r.description}>{r.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">{fmtNum(r.days)} j</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[r.status]}`}>
                      {r.status_label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {r.status === 'pending' && <span>Envoyée le {fmtDate(r.created_at, { day: '2-digit', month: '2-digit' })}</span>}
                    {['approved', 'rejected'].includes(r.status) && r.reviewed_by_name && (
                      <span>Par {r.reviewed_by_name}{r.reviewed_at && ` le ${fmtDate(r.reviewed_at, { day: '2-digit', month: '2-digit' })}`}</span>
                    )}
                    {r.status === 'rejected' && r.rejection_reason && (
                      <div className="mt-1 text-red-700">Motif : {r.rejection_reason}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canCancel(r) && (
                      <button
                        onClick={() => handleCancel(r)}
                        className="px-3 py-1 text-xs font-medium border border-gray-300 text-gray-700 rounded hover:bg-gray-50 inline-flex items-center gap-1"
                      >
                        <IconClose className="w-3.5 h-3.5" /> {r.status === 'pending' ? 'Retirer' : 'Annuler'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <RequestModal
          types={types}
          onClose={() => setShowForm(false)}
          onCreated={(req) => {
            setShowForm(false)
            notify('success', req.status === 'approved' ? 'Absence enregistrée et validée' : 'Demande envoyée à votre manager')
            if (new Date(req.start_date).getFullYear() !== year) setYear(new Date(req.start_date).getFullYear())
            else load()
          }}
        />
      )}
    </div>
  )
}

// =============================================================
// Carte de solde
// =============================================================
const COLORS = {
  purple: { icon: 'bg-purple-50 text-purple-700', used: 'bg-purple-500', pending: 'bg-purple-300', text: 'text-purple-700' },
  blue: { icon: 'bg-blue-50 text-salesforce-blue', used: 'bg-blue-500', pending: 'bg-blue-300', text: 'text-salesforce-blue' },
}

const BalanceCard = ({ icon: Icon, color, title, available, used, pending, total, details }) => {
  const c = COLORS[color]
  const pct = (v) => (total > 0 ? Math.min(100, (v / total) * 100) : 0)
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.icon}`}>
          <Icon className="w-5 h-5" />
        </span>
        <p className="font-semibold text-gray-900">{title}</p>
      </div>

      <p className={`text-3xl font-bold ${c.text}`}>
        {fmtNum(available)} <span className="text-base font-medium text-gray-500">j disponibles</span>
      </p>

      {/* Jauge : utilisé | en attente | disponible */}
      <div className="h-2 mt-3 rounded-full bg-gray-100 overflow-hidden flex">
        <div className={`${c.used} transition-all duration-500`} style={{ width: `${pct(used)}%` }} />
        <div className={`${c.pending} transition-all duration-500`} style={{ width: `${pct(pending)}%` }} />
      </div>

      <dl className="mt-3 space-y-1">
        {details.map(([k, v, warn]) => (
          <div key={k} className="flex justify-between gap-2 text-xs">
            <dt className="text-gray-500">{k}</dt>
            <dd className={`text-right ${warn ? 'text-orange-600 font-medium' : 'text-gray-800'}`}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// =============================================================
// Formulaire de demande avec aperçu en direct
// =============================================================
const RequestModal = ({ types, onClose, onCreated }) => {
  const [form, setForm] = useState({
    leave_type: 'cp',
    start_date: todayStr(),
    end_date: todayStr(),
    start_period: 'full',
    end_period: 'full',
    description: '',
  })
  const [preview, setPreview] = useState(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const timer = useRef(null)

  const singleDay = form.start_date === form.end_date
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  // Cohérence des demi-journées
  useEffect(() => {
    if (form.end_date < form.start_date) set({ end_date: form.start_date })
    if (!singleDay) {
      if (form.start_period === 'am') set({ start_period: 'full' })
      if (form.end_period === 'pm') set({ end_period: 'full' })
    }
  }, [form.start_date, form.end_date])

  // Aperçu en direct (300 ms après la dernière modification)
  useEffect(() => {
    if (!form.start_date || !form.end_date || form.end_date < form.start_date) return
    clearTimeout(timer.current)
    setChecking(true)
    timer.current = setTimeout(async () => {
      try {
        setPreview(
          await api.get('/leave-requests/preview/', {
            leave_type: form.leave_type,
            start_date: form.start_date,
            end_date: form.end_date,
            start_period: form.start_period,
            end_period: singleDay ? form.start_period : form.end_period,
          })
        )
      } catch (e) {
        setPreview({ days: 0, dates: [], error: e.message })
      } finally {
        setChecking(false)
      }
    }, 300)
    return () => clearTimeout(timer.current)
  }, [form.leave_type, form.start_date, form.end_date, form.start_period, form.end_period])

  const type = types.find((t) => t.key === form.leave_type)
  const remainingAfter = () => {
    if (!preview?.balance || !type?.counted) return null
    const b = form.leave_type === 'cp' ? preview.balance.cp : preview.balance.tt
    return b.available - preview.days
  }

  const submit = async () => {
    setSubmitError(null)
    setSaving(true)
    try {
      const req = await api.post('/leave-requests/', {
        ...form,
        end_period: singleDay ? form.start_period : form.end_period,
        description: form.description.trim(),
      })
      onCreated(req)
    } catch (e) {
      setSubmitError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const blocked = !preview || checking || !!preview.error || preview.days === 0 || saving
  const after = remainingAfter()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[92vh] overflow-y-auto">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Nouvelle demande d'absence</h2>
            <p className="text-sm text-gray-500">Elle sera envoyée à votre manager pour validation</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><IconClose className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type d'absence</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {types.map((t) => {
                const active = form.leave_type === t.key
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => set({ leave_type: t.key })}
                    className={`px-3 py-2 rounded-lg border-2 text-left transition ${
                      active ? 'border-salesforce-blue bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${TYPE_STYLES[t.key]?.split(' ')[0]}`} />
                    <span className={`text-sm ${active ? 'font-semibold text-salesforce-blue' : 'text-gray-800'}`}>
                      {t.label.replace(/ \(.+\)/, '')}
                    </span>
                    {t.counted && <span className="block text-[10px] text-gray-500 mt-0.5">décompté du solde</span>}
                  </button>
                )
              })}
            </div>
            {form.leave_type === 'tt' && (
              <p className="text-xs text-blue-700 mt-2">Le télétravail reste un jour travaillé : vous pourrez saisir votre CRA ces jours-là.</p>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Du</label>
              <input type="date" value={form.start_date} onChange={(e) => set({ start_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              <PeriodPicker
                value={form.start_period}
                options={singleDay ? ['full', 'am', 'pm'] : ['full', 'pm']}
                onChange={(v) => set({ start_period: v })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Au</label>
              <input type="date" value={form.end_date} min={form.start_date} onChange={(e) => set({ end_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              {!singleDay && (
                <PeriodPicker value={form.end_period} options={['full', 'am']} onChange={(v) => set({ end_period: v })} />
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400 font-normal">(facultatif)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Ex. : vacances en famille, mariage de mon frère…"
            />
          </div>

          {/* Aperçu */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            {checking || !preview ? (
              <p className="text-sm text-gray-500">Calcul en cours...</p>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm text-gray-700">
                    <span className="text-2xl font-bold text-gray-900">{fmtNum(preview.days)}</span> jour{preview.days > 1 ? 's' : ''} ouvré{preview.days > 1 ? 's' : ''}
                    <span className="text-gray-500"> (week-ends et fériés exclus)</span>
                  </p>
                  {after !== null && !preview.error && (
                    <p className="text-sm">
                      Solde {form.leave_type.toUpperCase()} après demande :{' '}
                      <span className={`font-bold ${after < 2 ? 'text-orange-600' : 'text-green-700'}`}>{fmtNum(after)} j</span>
                    </p>
                  )}
                </div>
                {preview.dates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 max-h-24 overflow-y-auto">
                    {preview.dates.map((d) => (
                      <span key={d.date} className={`px-2 py-0.5 rounded text-xs border ${TYPE_STYLES[form.leave_type]}`}>
                        {fmtDate(d.date, { weekday: 'short', day: '2-digit', month: '2-digit' })}
                        {d.period !== 'full' && ` · ${PERIOD_LABELS[d.period].toLowerCase()}`}
                      </span>
                    ))}
                  </div>
                )}
                {preview.error && <Alert severity="error" sx={{ mt: 2 }}>{preview.error}</Alert>}
              </>
            )}
          </div>

          {submitError && (
            <Alert severity="error">
              <AlertTitle>Demande refusée</AlertTitle>
              {submitError}
            </Alert>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Annuler</button>
          <button
            onClick={submit}
            disabled={blocked}
            className="px-4 py-2 bg-salesforce-blue text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <IconSend className="w-4 h-4" /> {saving ? 'Envoi...' : 'Envoyer la demande'}
          </button>
        </div>
      </div>
    </div>
  )
}

const PeriodPicker = ({ value, options, onChange }) => (
  <div className="flex gap-1 mt-2">
    {options.map((p) => (
      <button
        key={p}
        type="button"
        onClick={() => onChange(p)}
        className={`flex-1 px-2 py-1 text-xs rounded border transition ${
          value === p ? 'bg-salesforce-blue text-white border-salesforce-blue' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
      >
        {PERIOD_LABELS[p]}
      </button>
    ))}
  </div>
)

export default MyLeaves