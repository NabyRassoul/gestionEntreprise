import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useState, useEffect, useMemo } from 'react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import api from '../api'
import {
  IconHome, IconWarning, IconPending, IconCheck, IconX, IconUsers, IconFolder, IconSend, IconEdit,
  IconHistory, IconLink, IconTrend, IconZap, IconInbox, IconChevronRight,IconLeave , 
} from '../components/Icons'
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

const STATUS = {
  none: { label: 'Non commencé', cls: 'bg-white text-gray-500 border-gray-300 border-dashed' },
  draft: { label: 'Brouillon', cls: 'bg-gray-100 text-gray-700 border-gray-300' },
  submitted: { label: 'En attente', cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  validated: { label: 'Validé', cls: 'bg-green-100 text-green-800 border-green-300' },
  rejected: { label: 'Rejeté', cls: 'bg-red-100 text-red-800 border-red-300' },
}
const ROLE_LABELS = { admin: 'Administrateur', manager: 'Manager', collaborator: 'Collaborateur' }

const timeAgo = (d) => {
  if (!d) return ''
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60) return "à l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  const days = Math.floor(diff / 86400)
  return days === 1 ? 'hier' : `il y a ${days} j`
}

const Dashboard = () => {
  const { user, token } = useAuth()


  const [data, setData] = useState({ cras: [], projects: [], users: [], assignments: [], leaveReqs: [], balance: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) loadData()
  }, [token])

    const loadData = async () => {
    setLoading(true)
    const safe = (path, params) => api.list(path, params).catch(() => [])
    const [cras, projects, users, assignments, leaveReqs, balance] = await Promise.all([
      safe('/cra-submissions/'),
      safe('/projects/all_projects/'),
      safe('/users/'),
      safe('/assignments/'),
      safe('/leave-requests/', { status: 'pending' }),
      api.get('/leave-requests/balances/').catch(() => null),
    ])
    setData({ cras, projects, users, assignments, leaveReqs, balance })
    setLoading(false)
  }

  // ---------- Rôles ----------
  const role = user?.role
  const isAdmin = role === 'admin'
  const isManager = role === 'manager' || isAdmin
  const doesCRA = !isAdmin // collaborateurs + managers saisissent leurs CRA

  // ---------- Calculs ----------
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const monthLabel = `${MONTHS[month - 1]} ${year}`

  const d = useMemo(() => {
    const { cras, projects, users, assignments } = data
    const userName = (id) => {
      const u = users.find((x) => x.id === id)
      return u ? `${u.first_name} ${u.last_name}`.trim() || u.email : '—'
    }
    const projectById = new Map(projects.map((p) => [p.id, p]))
    const activeProjectIds = new Set(projects.filter((p) => p.status === 'active').map((p) => p.id))
    const activeUserIds = new Set(users.filter((u) => u.role !== 'admin' && u.is_active !== false).map((u) => u.id))

    const monthCras = cras.filter((c) => Number(c.month) === month && Number(c.year) === year)
    const findCra = (uid, pid) => monthCras.find((c) => c.user === uid && Number(c.project) === pid)

    // --- Personnel ---
    const myMonth = assignments
      .filter((a) => a.user === user?.id && activeProjectIds.has(a.project))
      .map((a) => {
        const cra = findCra(user?.id, a.project)
        return {
          id: a.project,
          name: a.project_name || projectById.get(a.project)?.name,
          code: a.project_code || projectById.get(a.project)?.code,
          status: cra?.status || 'none',
          cra,
        }
      })
    const myRejected = cras.filter((c) => c.user === user?.id && c.status === 'rejected')
    const myDone = myMonth.filter((m) => ['submitted', 'validated'].includes(m.status)).length

    // --- Équipe (manager/admin) ---
    const pending = cras
      .filter((c) => c.status === 'submitted' && c.user !== user?.id)
      .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at))

    const expected = assignments.filter((a) => activeProjectIds.has(a.project) && activeUserIds.has(a.user))
    const late = expected
      .filter((a) => {
        const c = findCra(a.user, a.project)
        return !c || ['draft', 'rejected'].includes(c.status)
      })
      .map((a) => ({
        key: a.id,
        user: userName(a.user),
        project: a.project_name || projectById.get(a.project)?.name,
        status: findCra(a.user, a.project)?.status || 'none',
      }))

    const submittedMonth = monthCras.filter((c) => c.status === 'submitted').length
    const validatedMonth = monthCras.filter((c) => c.status === 'validated').length
    const rejectedMonth = monthCras.filter((c) => c.status === 'rejected').length

    const recent = [...cras]
      .filter((c) => c.submitted_at)
      .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
      .slice(0, 6)

          // --- Absences ---
    const leavesToReview = data.leaveReqs
      .filter((r) => r.can_review)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
    const myPendingLeaves = data.leaveReqs.filter((r) => r.user === user?.id)
    return {
      myMonth, myRejected, myDone,
      pending, expected: expected.length, late,
      submittedMonth, validatedMonth, rejectedMonth,
      activeUsers: activeUserIds.size, activeProjects: activeProjectIds.size,
      recent, userName, leavesToReview, myPendingLeaves,
    }
  }, [data, user?.id, month, year])

  // ---------- Salutation ----------
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
  const todayLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // ---------- Actions rapides ----------
  const actions = [
    { show: doesCRA, icon: IconEdit, label: 'Saisir mon CRA', to: '/cra/submit' },
    { show: doesCRA, icon: IconHistory, label: 'Historique de mes CRA', to: '/cra/history' },
     { show: doesCRA, icon: IconLeave, label: 'Mes absences', to: '/leaves', count: d.myPendingLeaves.length },
    { show: isManager, icon: IconLeave, label: 'Absences équipe', to: '/admin/leaves', count: d.leavesToReview.length },
    { show: isManager, icon: IconCheck, label: 'Valider les CRA', to: '/admin/validation', count: d.pending.length },
    { show: isManager, icon: IconFolder, label: 'Projets', to: '/admin/projects' },
    { show: isManager, icon: IconLink, label: 'Attributions', to: '/admin/assignments' },
    { show: isAdmin, icon: IconUsers, label: 'Utilisateurs', to: '/admin/users' },
  ].filter((a) => a.show)

  // ---------- Rendu ----------
  if (loading) return <DashboardSkeleton />

  const progress = d.expected ? Math.round(((d.submittedMonth + d.validatedMonth) / d.expected) * 100) : 0
  const validatedPct = d.expected ? Math.round((d.validatedMonth / d.expected) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Bandeau d'accueil */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-salesforce-blue via-blue-400 to-cyan-400" />
        <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-salesforce-blue text-white flex items-center justify-center shadow">
              <IconHome className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Accueil</p>
              <h1 className="text-2xl font-bold text-gray-900">
                {greeting}, {user?.first_name} 👋
              </h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-700 capitalize">{todayLabel}</p>
            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-salesforce-blue border border-blue-200">
              {ROLE_LABELS[role] || role}
            </span>
          </div>
        </div>
      </div>

      
            {/* Alerte CRA rejetés */}
      {doesCRA && d.myRejected.length > 0 && (
        <Alert
          severity="error"
          action={
            <Button component={Link} to="/cra/submit" color="error" variant="contained" size="small">
              Corriger
            </Button>
          }
        >
          <AlertTitle>
            {d.myRejected.length} CRA rejeté{d.myRejected.length > 1 ? 's' : ''} à corriger
          </AlertTitle>
          {d.myRejected.map((c) => `${c.project_name} (${MONTHS[c.month - 1]})`).join(' · ')}
        </Alert>
      )}

      {/* KPIs */}
      <div className={`grid grid-cols-2 ${isManager ? 'lg:grid-cols-6' : 'lg:grid-cols-4'} gap-4`}>
        {isManager ? (
          <>
            <Kpi to="/admin/validation" icon={IconPending} label="CRA à valider" value={d.pending.length} color="text-yellow-600" bg="bg-yellow-50" />
            <Kpi to="/admin/validation" icon={IconCheck} label={`CRA Validés · ${MONTHS[month - 1]}`} value={d.validatedMonth} color="text-green-600" bg="bg-green-50" />
            <Kpi to="/admin/validation" icon={IconX} label={`CRA Rejetés · ${MONTHS[month - 1]}`} value={d.rejectedMonth} color="text-red-600" bg="bg-red-50" />
                                    <Kpi to="/admin/leaves" icon={IconLeave} label="Absences à valider" value={d.leavesToReview.length} color="text-purple-600" bg="bg-purple-50" />
            <Kpi to={isAdmin ? '/admin/users' : '/admin/assignments'} icon={IconUsers} label="Collaborateurs actifs" value={d.activeUsers} color="text-salesforce-blue" bg="bg-blue-50" />
            <Kpi to="/admin/projects" icon={IconFolder}label="Projets actifs" value={d.activeProjects} color="text-purple-600" bg="bg-purple-50" />
          </>
        ) : (
          <>
            <Kpi to="/cra/submit" icon={IconFolder} label="Mes projets" value={d.myMonth.length} color="text-salesforce-blue" bg="bg-blue-50" />
            <Kpi to="/cra/submit" icon={IconSend} label={`Soumis · ${MONTHS[month - 1]}`} value={`${d.myDone}/${d.myMonth.length}`} color="text-green-600" bg="bg-green-50" />
            <Kpi to="/cra/submit" icon={IconEdit} label="Brouillons" value={d.myMonth.filter((m) => m.status === 'draft').length} color="text-gray-700" bg="bg-gray-50" />
            <Kpi to="/cra/submit" icon={IconX} label="À corriger" value={d.myRejected.length} color="text-red-600" bg="bg-red-50" />
          </>
        )}
      </div>

      {/* Contenu */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">
          {/* Mes CRA du mois */}
          {doesCRA && (
            <Card
              icon={IconEdit}
              title={`Mes CRA · ${monthLabel}`}
              subtitle={`${d.myDone} sur ${d.myMonth.length} projet(s) soumis`}
              action={<Link to="/cra/submit" className="text-sm text-salesforce-blue hover:underline">Ouvrir le calendrier</Link>}
            >
              {d.myMonth.length === 0 ? (
                <Empty icon={IconInbox} text="Aucun projet attribué. Contactez votre manager." />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {d.myMonth.map((m) => (
                    <li key={m.id} className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-gray-50">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{m.name}</p>
                        <p className="text-xs text-gray-500">{m.code}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge status={m.status} />
                        {['none', 'draft', 'rejected'].includes(m.status) ? (
                          <Link
                            to="/cra/submit"
                            className={`px-3 py-1 text-xs font-medium rounded border ${
                              m.status === 'rejected'
                                ? 'border-red-300 text-red-700 hover:bg-red-50'
                                : 'border-salesforce-blue text-salesforce-blue hover:bg-blue-50'
                            }`}
                          >
                            {m.status === 'rejected' ? 'Corriger' : m.status === 'draft' ? 'Continuer' : 'Saisir'}
                          </Link>
                        ) : (
                          <span className="w-[72px]" />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {/* CRA à valider */}
          {isManager && (
            <Card
              icon={IconCheck}
              title="CRA à valider"
              subtitle={d.pending.length ? `${d.pending.length} en attente · les plus anciens en premier` : 'Tout est à jour'}
              action={<Link to="/admin/validation" className="text-sm text-salesforce-blue hover:underline">Voir tout</Link>}
            >
              {d.pending.length === 0 ? (
                <Empty icon={IconCheck} text="Aucun CRA en attente de validation" />
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-2 text-left text-xs font-semibold uppercase text-gray-600">Collaborateur</th>
                      <th className="px-5 py-2 text-left text-xs font-semibold uppercase text-gray-600">Projet</th>
                      <th className="px-5 py-2 text-left text-xs font-semibold uppercase text-gray-600">Mois</th>
                      <th className="px-5 py-2 text-left text-xs font-semibold uppercase text-gray-600">Soumis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {d.pending.slice(0, 5).map((c) => (
                      <tr key={c.id} className="hover:bg-blue-50/40">
                        <td className="px-5 py-2.5 font-medium text-salesforce-blue">{c.user_name?.trim() || c.user_email}</td>
                        <td className="px-5 py-2.5 text-gray-700">{c.project_name || '—'}</td>
                        <td className="px-5 py-2.5 text-gray-700">{MONTHS[c.month - 1]} {c.year}</td>
                        <td className="px-5 py-2.5 text-gray-500">{timeAgo(c.submitted_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {d.pending.length > 5 && (
                <div className="px-5 py-2 border-t border-gray-100 text-right">
                  <Link to="/admin/validation" className="text-xs text-salesforce-blue hover:underline">
                    + {d.pending.length - 5} autre(s)
                  </Link>
                </div>
              )}
            </Card>
          )}

                  {isManager && (
            <Card
              icon={IconLeave}
              title="Absences à valider"
              subtitle={d.leavesToReview.length ? `${d.leavesToReview.length} demande(s) · les plus proches en premier` : 'Tout est à jour'}
              action={<Link to="/admin/leaves" className="text-sm text-salesforce-blue hover:underline">Voir tout</Link>}
            >
              {d.leavesToReview.length === 0 ? (
                <Empty icon={IconCheck} text="Aucune demande d'absence en attente" />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {d.leavesToReview.slice(0, 5).map((r) => (
                    <li key={r.id} className="px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-blue-50/40">
                      <div className="min-w-0">
                        <p className="font-medium text-salesforce-blue truncate">{r.user_name}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(r.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          {r.end_date !== r.start_date && ` → ${new Date(r.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`}
                          {' · '}{String(Number(r.days)).replace('.', ',')} j
                        </p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${
                        r.leave_type === 'tt' ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-purple-100 text-purple-800 border-purple-300'
                      }`}>
                        {r.leave_type_label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {d.leavesToReview.length > 5 && (
                <div className="px-5 py-2 border-t border-gray-100 text-right">
                  <Link to="/admin/leaves" className="text-xs text-salesforce-blue hover:underline">
                    + {d.leavesToReview.length - 5} autre(s)
                  </Link>
                </div>
              )}
            </Card>
          )}
          {/* Suivi du mois */}
          {isManager && (
            <Card icon={IconTrend} title={`Suivi · ${monthLabel}`} subtitle={`${d.expected} CRA attendus (collaborateurs × projets actifs)`}>
              <div className="px-5 py-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-700">Soumis ou validés</span>
                  <span className="font-semibold text-gray-900">{progress}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                  <div className="bg-green-500 transition-all duration-700" style={{ width: `${validatedPct}%` }} />
                  <div className="bg-yellow-400 transition-all duration-700" style={{ width: `${Math.max(progress - validatedPct, 0)}%` }} />
                </div>
                <div className="flex gap-4 mt-2 text-xs text-gray-600">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Validés {d.validatedMonth}</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-400" /> En attente {d.submittedMonth}</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gray-200" /> Manquants {d.late.length}</span>
                </div>
              </div>

              <div className="border-t border-gray-100">
                <p className="px-5 pt-3 pb-1 text-xs font-semibold uppercase text-gray-600">
                  Retardataires ({d.late.length})
                </p>
                {d.late.length === 0 ? (
                  <Empty icon={IconCheck} text="Tous les CRA du mois sont soumis" />
                ) : (
                  <ul className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {d.late.map((l) => (
                      <li key={l.key} className="px-5 py-2 flex items-center justify-between text-sm">
                        <span className="text-gray-900">
                          {l.user} <span className="text-gray-400">· {l.project}</span>
                        </span>
                        <Badge status={l.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Colonne droite */}
        <div className="space-y-6">
                    {doesCRA && data.balance && (
            <Card
              icon={IconLeave}
              title="Mes absences"
              subtitle={d.myPendingLeaves.length ? `${d.myPendingLeaves.length} demande(s) en attente` : `Soldes ${data.balance.year}`}
              action={<Link to="/leaves" className="text-sm text-salesforce-blue hover:underline">Gérer</Link>}
            >
              <div className="px-5 py-4 space-y-4">
                {[
                  {
                    label: 'Congés payés',
                    icon: IconLeave,
                    b: data.balance.cp,
                    color: 'purple',
                    total: data.balance.cp.taken + data.balance.cp.pending + data.balance.cp.available,
                  },
                  { label: 'Télétravail', icon: IconHome, b: data.balance.tt, color: 'blue', total: data.balance.tt.quota },
                ].map(({ label, icon: Icon, b, color, total }) => {
                  const pct = (v) => (total > 0 ? Math.min(100, (v / total) * 100) : 0)
                  const fmt = (v) => String(v).replace('.', ',')
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-gray-700">
                          <Icon className={`w-4 h-4 ${color === 'purple' ? 'text-purple-600' : 'text-blue-600'}`} /> {label}
                        </span>
                        <span className={`font-bold ${color === 'purple' ? 'text-purple-700' : 'text-salesforce-blue'}`}>
                          {fmt(b.available)} j
                        </span>
                      </div>
                      <div className="h-1.5 mt-1.5 rounded-full bg-gray-100 overflow-hidden flex">
                        <div className={color === 'purple' ? 'bg-purple-500' : 'bg-blue-500'} style={{ width: `${pct(b.taken)}%` }} />
                        <div className={color === 'purple' ? 'bg-purple-300' : 'bg-blue-300'} style={{ width: `${pct(b.pending)}%` }} />
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Pris {fmt(b.taken)} j · En attente {fmt(b.pending)} j
                        {b.carry_over > 0 && (
                          <span className="text-orange-600"> · dont {fmt(b.carry_over)} j de report à prendre avant le 31/12</span>
                        )}
                      </p>
                    </div>
                  )
                })}
                <Link
                  to="/leaves"
                  className="w-full px-3 py-2 text-sm border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 flex items-center justify-center gap-2"
                >
                  <IconLeave className="w-4 h-4" /> Nouvelle demande
                </Link>
              </div>
            </Card>
          )}
          <Card icon={IconZap} title="Actions rapides">
            <ul className="divide-y divide-gray-100">
              {actions.map((a) => (
                <li key={a.to}>
                  <Link to={a.to} className="px-5 py-3 flex items-center justify-between group hover:bg-blue-50/50">
                    <span className="flex items-center gap-3 text-sm text-gray-800">
                                           <span className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <a.icon className="w-4 h-4 text-salesforce-blue" />
                      </span>
                      {a.label}
                    </span>
                    <span className="flex items-center gap-2">
                      {a.count > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">{a.count}</span>
                      )}
                       <IconChevronRight className="w-4 h-4 text-gray-300 group-hover:text-salesforce-blue group-hover:translate-x-0.5 transition" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card icon={IconHistory} title="Activité récente">
            {d.recent.length === 0 ? (
              <Empty icon={IconInbox} text="Aucune activité pour le moment" />
            ) : (
              <ul className="px-5 py-3 space-y-4">
                {d.recent.map((c) => (
                  <li key={c.id} className="flex gap-3">
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                        c.status === 'validated' ? 'bg-green-500' : c.status === 'rejected' ? 'bg-red-500' : 'bg-yellow-400'
                      }`}
                    />
                    <div className="min-w-0 text-sm">
                      <p className="text-gray-800">
                        <span className="font-medium">{c.user === user?.id ? 'Vous' : c.user_name?.trim() || c.user_email}</span>
                        {' '}— {c.project_name || 'CRA'} · {MONTHS[c.month - 1]}
                      </p>
                      <p className="text-xs text-gray-500">
                        {STATUS[c.status]?.label} · {timeAgo(c.submitted_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

// ---------- Composants ----------
const Card = ({ icon: Icon, title, subtitle, action, children }) => (
  <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
    <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-salesforce-blue" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-900 truncate">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
    {children}
  </div>
)

const Kpi = ({ to, icon: Icon, label, value, color, bg }) => (
  <Link
    to={to}
    className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 hover:shadow-md hover:-translate-y-0.5 transition-all group"
  >
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs text-gray-600 truncate">{label}</p>
      <span className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </span>
    </div>
    <p className={`text-3xl font-bold ${color}`}>{value}</p>
  </Link>
)

const Empty = ({ icon: Icon, text }) => (
  <div className="px-5 py-8 text-center">
    <Icon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
    <p className="text-sm text-gray-500">{text}</p>
  </div>
)
const Badge = ({ status }) => (
  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${STATUS[status]?.cls}`}>
    {STATUS[status]?.label}
  </span>
)


const DashboardSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="h-24 bg-white rounded-lg border border-gray-200" />
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-24 bg-white rounded-lg border border-gray-200" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 h-80 bg-white rounded-lg border border-gray-200" />
      <div className="h-80 bg-white rounded-lg border border-gray-200" />
    </div>
  </div>
)

export default Dashboard