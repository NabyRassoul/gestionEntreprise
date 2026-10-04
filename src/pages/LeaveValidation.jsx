import { useState, useEffect, useMemo } from 'react'
import Alert from '@mui/material/Alert'
import api from '../api'
import { useAuth } from '../contexts/AuthContext'
import { useFeedback } from '../contexts/FeedbackContext'
import {
  IconLeave, IconHome, IconCheck, IconX, IconRefresh, IconClose, IconInbox,
  IconChevronLeft, IconChevronRight, IconUsers, IconPending, IconSearch,
} from '../components/Icons'

// ---------- Styles & helpers ----------
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
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

const fmtNum = (v) => String(Math.round(Number(v) * 10) / 10).replace('.', ',')
const fmtDate = (d, opts = { day: '2-digit', month: 'short', year: 'numeric' }) => new Date(d).toLocaleDateString('fr-FR', opts)
const periodLabel = (r) => {
  if (r.start_date === r.end_date) {
    return `${fmtDate(r.start_date)}${r.start_period !== 'full' ? ` · ${PERIOD_LABELS[r.start_period].toLowerCase()}` : ''}`
  }
  const short = { day: '2-digit', month: 'short' }
  return `${fmtDate(r.start_date, short)}${r.start_period === 'pm' ? ' (ap.-midi)' : ''} → ${fmtDate(r.end_date)}${r.end_period === 'am' ? ' (matin)' : ''}`
}
const coversMonth = (r, year, month) => {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return new Date(r.start_date) <= end && new Date(r.end_date) >= start
}

// =============================================================
const LeaveValidation = () => {
  const { user } = useAuth()
  const { notify, confirm: ask } = useFeedback()

  const [tab, setTab] = useState('requests')
  const [year, setYear] = useState(new Date().getFullYear())
  const [types, setTypes] = useState([])
  const [requests, setRequests] = useState([])
  const [balances, setBalances] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: 'pending', user: '', type: '', month: '' })
  const [expandedId, setExpandedId] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.list('/leave-requests/types/').then(setTypes).catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [year])

  const load = async () => {
    setLoading(true)
    try {
      const [reqs, bals] = await Promise.all([
        api.list('/leave-requests/', { year }),
        api.list('/leave-requests/balances/', { all: 1, year }),
      ])
      setRequests(reqs.filter((r) => r.user !== user.id)) // ses propres demandes sont traitées par quelqu'un d'autre
      setBalances(bals)
    } catch (e) {
      notify('error', e.message)
    } finally {
      setLoading(false)
    }
  }

  const balanceOf = (uid) => balances.find((b) => b.user === uid)

  // ---------- Filtres ----------
  const people = useMemo(() => {
    const map = new Map()
    requests.forEach((r) => map.set(r.user, r.user_name))
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [requests])

  const base = requests.filter(
    (r) =>
      (!filters.user || String(r.user) === filters.user) &&
      (!filters.type || r.leave_type === filters.type) &&
      (!filters.month || coversMonth(r, year, Number(filters.month)))
  )
  const counts = {
    pending: base.filter((r) => r.status === 'pending').length,
    approved: base.filter((r) => r.status === 'approved').length,
    rejected: base.filter((r) => r.status === 'rejected').length,
  }
  const rows = base
    .filter((r) => (filters.status ? r.status === filters.status : r.status !== 'cancelled'))
    .sort((a, b) => (a.status === 'pending' ? a.start_date.localeCompare(b.start_date) : b.created_at.localeCompare(a.created_at)))

  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }))

  // ---------- Actions ----------
  const balanceInfo = (r) => {
    const b = balanceOf(r.user)
    if (!b) return ''
    if (r.leave_type === 'cp') return `Solde CP restant après validation : ${fmtNum(b.cp.available)} j`
    if (r.leave_type === 'tt') return `Solde TT restant après validation : ${fmtNum(b.tt.available)} j sur ${fmtNum(b.tt.quota)}`
    return ''
  }

  const handleApprove = async (r) => {
    const info = balanceInfo(r)
    const ok = await ask({
      title: "Valider l'absence",
      message:
        `${r.user_name}\n${r.leave_type_label} · ${periodLabel(r)} · ${fmtNum(r.days)} j` +
        (info ? `\n\n${info}` : '') +
        (r.description ? `\n\n« ${r.description} »` : ''),
      confirmText: 'Valider',
      severity: 'success',
    })
    if (!ok) return
    setBusyId(r.id)
    try {
      await api.post(`/leave-requests/${r.id}/approve/`)
      notify('success', `Absence de ${r.user_name} validée`)
      await load()
    } catch (e) {
      notify('error', e.message)
    } finally {
      setBusyId(null)
    }
  }

  const handleReject = async (reason) => {
    const r = rejectTarget
    setRejectTarget(null)
    setBusyId(r.id)
    try {
      await api.post(`/leave-requests/${r.id}/reject/`, { reason })
      notify('success', `Demande de ${r.user_name} refusée`)
      await load()
    } catch (e) {
      notify('error', e.message)
    } finally {
      setBusyId(null)
    }
  }

  // ---------- Soldes ----------
  const balanceRows = balances
    .filter((b) => b.user !== user.id || user.role === 'admin')
    .filter((b) => `${b.user_name} ${b.email}`.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Absences de l'équipe</h1>
          <p className="text-gray-600">Validez les demandes et suivez les soldes de chacun</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-gray-300 rounded-lg bg-white">
            <button onClick={() => setYear(year - 1)} className="px-3 py-2 hover:bg-gray-50 rounded-l-lg"><IconChevronLeft className="w-4 h-4" /></button>
            <span className="px-4 py-2 font-semibold text-gray-900 border-x border-gray-300">{year}</span>
            <button onClick={() => setYear(year + 1)} className="px-3 py-2 hover:bg-gray-50 rounded-r-lg"><IconChevronRight className="w-4 h-4" /></button>
          </div>
          <button onClick={load} className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 text-sm">
            <IconRefresh className="w-4 h-4" /> Actualiser
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {[
          { key: 'requests', label: 'Demandes', icon: IconLeave, badge: requests.filter((r) => r.status === 'pending').length },
          { key: 'balances', label: 'Soldes', icon: IconUsers },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 -mb-px transition ${
              tab === t.key ? 'border-salesforce-blue text-salesforce-blue' : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
            {t.badge > 0 && (
              <span className="min-w-[20px] px-1.5 py-0.5 rounded-full bg-yellow-400 text-yellow-900 text-[11px] font-bold">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-500">Chargement...</div>
      ) : tab === 'requests' ? (
        <>
          {/* Compteurs */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { key: 'pending', label: 'En attente', color: 'text-yellow-600', ring: 'ring-yellow-500' },
              { key: 'approved', label: 'Validées', color: 'text-green-600', ring: 'ring-green-500' },
              { key: 'rejected', label: 'Refusées', color: 'text-red-600', ring: 'ring-red-500' },
            ].map((c) => (
              <button
                key={c.key}
                onClick={() => setFilter('status', filters.status === c.key ? '' : c.key)}
                className={`bg-white rounded-lg p-4 shadow-sm border border-gray-200 text-left hover:shadow-md transition-shadow ${
                  filters.status === c.key ? `ring-2 ${c.ring}` : ''
                }`}
              >
                <p className="text-sm text-gray-600 mb-1">{c.label}</p>
                <p className={`text-2xl font-bold ${c.color}`}>{counts[c.key]}</p>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            {/* Filtres */}
            <div className="px-4 py-3 border-b border-gray-200 grid grid-cols-1 md:grid-cols-5 gap-3">
              <select value={filters.user} onChange={(e) => setFilter('user', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
                <option value="">Toutes les personnes</option>
                {people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
              <select value={filters.type} onChange={(e) => setFilter('type', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
                <option value="">Tous les types</option>
                {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <select value={filters.month} onChange={(e) => setFilter('month', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
                <option value="">Tous les mois</option>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded">
                <option value="">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="approved">Validées</option>
                <option value="rejected">Refusées</option>
                <option value="cancelled">Annulées</option>
              </select>
              <button
                onClick={() => setFilters({ status: '', user: '', type: '', month: '' })}
                className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center gap-1.5"
              >
                <IconClose className="w-4 h-4" /> Réinitialiser
              </button>
            </div>

            {/* Tableau */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-8"></th>
                    {['Personne', 'Type', 'Période', 'Jours', 'Envoyée le', 'Statut', 'Actions'].map((h, i) => (
                      <th key={h} className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600 ${i === 3 ? 'text-right' : i === 6 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan="8" className="px-4 py-12 text-center text-gray-500">
                        <IconInbox className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        {filters.status === 'pending' ? 'Aucune demande en attente 🎉' : 'Aucune demande ne correspond aux filtres'}
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => {
                    const expanded = expandedId === r.id
                    const busy = busyId === r.id
                    const b = balanceOf(r.user)
                    return (
                      <FragmentRow key={r.id}>
                        <tr className={`border-b border-gray-100 hover:bg-blue-50/40 ${expanded ? 'bg-blue-50/40' : ''}`}>
                          <td className="pl-3">
                            <button
                              onClick={() => setExpandedId(expanded ? null : r.id)}
                              className="text-gray-400 hover:text-gray-700 transition-transform"
                              style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                            >
                              <IconChevronRight className="w-4 h-4" />
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-salesforce-blue">{r.user_name}</div>
                            <div className="text-xs text-gray-500">{r.user_email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${TYPE_STYLES[r.leave_type]}`}>
                              {r.leave_type_label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{periodLabel(r)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtNum(r.days)} j</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(r.created_at, { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[r.status]}`}>
                              {r.status_label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2" title={!r.can_review && r.status === 'pending' ? "Hors de votre équipe" : ''}>
                              <button
                                onClick={() => setRejectTarget(r)}
                                disabled={!r.can_review || busy}
                                className="px-3 py-1 text-xs font-medium border border-red-300 text-red-700 rounded hover:bg-red-50 inline-flex items-center gap-1 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                              >
                                <IconX className="w-3.5 h-3.5" /> Refuser
                              </button>
                              <button
                                onClick={() => handleApprove(r)}
                                disabled={!r.can_review || busy}
                                className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 inline-flex items-center gap-1 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-green-600"
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
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold uppercase text-gray-600">Détail</p>
                                  <p className="text-sm text-gray-800">{r.description || <span className="text-gray-400">Aucune description</span>}</p>
                                  {r.reviewed_by_name && (
                                    <p className="text-xs text-gray-500">
                                      Traitée par {r.reviewed_by_name}{r.reviewed_at && ` le ${fmtDate(r.reviewed_at, { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
                                    </p>
                                  )}
                                  {r.status === 'rejected' && r.rejection_reason && (
                                    <Alert severity="error" sx={{ py: 0 }}>Motif : {r.rejection_reason}</Alert>
                                  )}
                                </div>
                                {b && r.counted && (
                                  <div>
                                    <p className="text-xs font-semibold uppercase text-gray-600 mb-2">Solde de {r.user_name} · {year}</p>
                                    {r.leave_type === 'cp' ? (
                                      <BalanceMini
                                        color="purple"
                                        available={b.cp.available}
                                        used={b.cp.taken}
                                        pending={b.cp.pending}
                                        lines={[
                                          b.cp.carry_over > 0 && `Report ${year - 1} : ${fmtNum(b.cp.carry_over)} j (expire le 31/12/${year})`,
                                          `Pris : ${fmtNum(b.cp.taken)} j · En attente : ${fmtNum(b.cp.pending)} j`,
                                        ]}
                                      />
                                    ) : (
                                      <BalanceMini
                                        color="blue"
                                        available={b.tt.available}
                                        used={b.tt.taken}
                                        pending={b.tt.pending}
                                        lines={[`Quota : ${fmtNum(b.tt.quota)} j · Utilisés : ${fmtNum(b.tt.taken)} j · En attente : ${fmtNum(b.tt.pending)} j`]}
                                      />
                                    )}
                                  </div>
                                )}
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
        </>
      ) : (
        /* ---------- Onglet Soldes ---------- */
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">Soldes {year}</h2>
              <p className="text-xs text-gray-500">{balanceRows.length} personne{balanceRows.length > 1 ? 's' : ''}</p>
            </div>
            <div className="relative w-64">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une personne..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-600">Personne</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-600">
                    <span className="inline-flex items-center gap-1.5"><IconLeave className="w-3.5 h-3.5 text-purple-600" /> Congés payés</span>
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-600">
                    <span className="inline-flex items-center gap-1.5"><IconHome className="w-3.5 h-3.5 text-blue-600" /> Télétravail</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {balanceRows.length === 0 && (
                  <tr><td colSpan="3" className="px-4 py-10 text-center text-gray-500">Aucune personne</td></tr>
                )}
                {balanceRows.map((b) => (
                  <tr key={b.user} className="border-b border-gray-100 hover:bg-blue-50/40 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{b.user_name}</div>
                      <div className="text-xs text-gray-500">{b.email}</div>
                    </td>
                    <td className="px-4 py-3 min-w-[260px]">
                      <BalanceMini
                        color="purple"
                        available={b.cp.available}
                        used={b.cp.taken}
                        pending={b.cp.pending}
                        lines={[
                          b.cp.carry_over > 0 && `dont report ${year - 1} : ${fmtNum(b.cp.carry_over)} j (expire 31/12)`,
                          `Pris ${fmtNum(b.cp.taken)} j · En attente ${fmtNum(b.cp.pending)} j`,
                        ]}
                      />
                    </td>
                    <td className="px-4 py-3 min-w-[240px]">
                      <BalanceMini
                        color="blue"
                        available={b.tt.available}
                        used={b.tt.taken}
                        pending={b.tt.pending}
                        suffix={` / ${fmtNum(b.tt.quota)}`}
                        lines={[`Utilisés ${fmtNum(b.tt.taken)} j · En attente ${fmtNum(b.tt.pending)} j`]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rejectTarget && <RejectModal request={rejectTarget} onConfirm={handleReject} onClose={() => setRejectTarget(null)} />}
    </div>
  )
}

const FragmentRow = ({ children }) => <>{children}</>

// ---------- Solde compact avec jauge ----------
const BalanceMini = ({ color, available, used, pending, lines, suffix = '' }) => {
  const total = used + pending + available
  const pct = (v) => (total > 0 ? (v / total) * 100 : 0)
  const c = color === 'purple'
    ? { text: 'text-purple-700', used: 'bg-purple-500', pending: 'bg-purple-300' }
    : { text: 'text-salesforce-blue', used: 'bg-blue-500', pending: 'bg-blue-300' }
  return (
    <div>
      <p className={`text-lg font-bold ${c.text}`}>
        {fmtNum(available)} j<span className="text-xs font-medium text-gray-500">{suffix} disponibles</span>
      </p>
      <div className="h-1.5 mt-1 rounded-full bg-gray-100 overflow-hidden flex w-48">
        <div className={c.used} style={{ width: `${pct(used)}%` }} />
        <div className={c.pending} style={{ width: `${pct(pending)}%` }} />
      </div>
      {lines.filter(Boolean).map((l) => (
        <p key={l} className={`text-[11px] mt-1 ${l.includes('expire') ? 'text-orange-600' : 'text-gray-500'}`}>{l}</p>
      ))}
    </div>
  )
}

// ---------- Refus avec motif ----------
const RejectModal = ({ request: r, onConfirm, onClose }) => {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Refuser la demande</h2>
          <p className="text-sm text-gray-600 mt-1">
            {r.user_name} · {r.leave_type_label} · {periodLabel(r)} · {fmtNum(r.days)} j
          </p>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium mb-2">
            Motif du refus <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            autoFocus
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Ex. : période de livraison client, merci de décaler d'une semaine."
          />
          <Alert severity="info" sx={{ mt: 2 }}>
            La personne recevra une notification avec ce motif et pourra faire une nouvelle demande.
          </Alert>
        </div>
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Annuler</button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Refuser
          </button>
        </div>
      </div>
    </div>
  )
}

export default LeaveValidation