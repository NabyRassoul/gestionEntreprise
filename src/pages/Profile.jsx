import { useState } from 'react'
import Alert from '@mui/material/Alert'
import { useAuth } from '../contexts/AuthContext'
import { useFeedback } from '../contexts/FeedbackContext'
import api from '../api'
import { IconUser, IconLock, IconSave, IconEye, IconEyeOff, IconMail } from '../components/Icons'

const ROLE_LABELS = { admin: 'Administrateur', manager: 'Manager', collaborator: 'Collaborateur' }

const Profile = () => {
  const { user, updateSession } = useAuth()
  const { notify } = useFeedback()

  return (
    <div className="max-w-4xl space-y-6">
      {/* En-tête */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-salesforce-blue via-blue-400 to-cyan-400" />
        <div className="px-6 py-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-salesforce-blue text-white flex items-center justify-center text-2xl font-bold">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{user?.first_name} {user?.last_name}</h1>
            <p className="text-gray-600 flex items-center gap-1.5 text-sm">
              <IconMail className="w-4 h-4" /> {user?.email}
            </p>
            <div className="flex gap-2 mt-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-salesforce-blue border border-blue-200">
                {ROLE_LABELS[user?.role] || user?.role}
              </span>
              {user?.department && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                  {user.department}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InfoCard user={user} onSaved={(u) => { updateSession({ user: u }); notify('success', 'Profil mis à jour') }} />
        <PasswordCard onChanged={(token) => { updateSession({ token }); notify('success', 'Mot de passe modifié. Les autres appareils ont été déconnectés.') }} />
      </div>
    </div>
  )
}

// ---------- Informations personnelles ----------
const InfoCard = ({ user, onSaved }) => {
  const [form, setForm] = useState({ first_name: user?.first_name || '', last_name: user?.last_name || '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const dirty = form.first_name !== (user?.first_name || '') || form.last_name !== (user?.last_name || '')

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.first_name.trim() || !form.last_name.trim()) return setError('Le prénom et le nom sont obligatoires')
    setSaving(true)
    try {
      const updated = await api.patch('/auth/me/', {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      })
      onSaved(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card icon={IconUser} title="Informations personnelles">
      <form onSubmit={submit} className="p-5 space-y-4">
        {error && <Alert severity="error">{error}</Alert>}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prénom">
            <input
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>
          <Field label="Nom">
            <input
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>
        </div>

        <Field label="Email">
          <input value={user?.email || ''} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Rôle">
            <input value={ROLE_LABELS[user?.role] || ''} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500" />
          </Field>
          <Field label="Département">
            <input value={user?.department || '—'} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500" />
          </Field>
        </div>
        <Alert severity="info" sx={{ py: 0 }}>
          L'email, le rôle et le département sont gérés par un administrateur.
        </Alert>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!dirty || saving}
            className="px-4 py-2 bg-salesforce-blue text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <IconSave className="w-4 h-4" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Card>
  )
}

// ---------- Mot de passe ----------
const PasswordCard = ({ onChanged }) => {
  const empty = { current_password: '', new_password: '', confirm: '' }
  const [form, setForm] = useState(empty)
  const [show, setShow] = useState(false)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const pwd = form.new_password
  const rules = [
    { ok: pwd.length >= 8, label: '8 caractères minimum' },
    { ok: /[A-Za-z]/.test(pwd) && /\d/.test(pwd), label: 'Des lettres et des chiffres' },
    { ok: pwd.length > 0 && pwd === form.confirm, label: 'Les deux saisies correspondent' },
  ]

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.current_password) return setError('Saisissez votre mot de passe actuel')
    if (!rules.every((r) => r.ok)) return setError('Le nouveau mot de passe ne respecte pas les règles')
    setSaving(true)
    try {
      const data = await api.post('/auth/change-password/', {
        current_password: form.current_password,
        new_password: form.new_password,
      })
      setForm(empty)
      onChanged(data.token)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const input = (name, label, autoComplete) => (
    <Field label={label}>
      <div className="relative">
        <IconLock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type={show ? 'text' : 'password'}
          value={form[name]}
          autoComplete={autoComplete}
          onChange={(e) => setForm({ ...form, [name]: e.target.value })}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </Field>
  )

  return (
    <Card
      icon={IconLock}
      title="Sécurité"
      action={
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="text-xs text-gray-500 hover:text-salesforce-blue flex items-center gap-1"
        >
          {show ? <><IconEyeOff className="w-3.5 h-3.5" /> Masquer</> : <><IconEye className="w-3.5 h-3.5" /> Afficher</>}
        </button>
      }
    >
      <form onSubmit={submit} className="p-5 space-y-4">
        {error && <Alert severity="error">{error}</Alert>}
        {input('current_password', 'Mot de passe actuel', 'current-password')}
        {input('new_password', 'Nouveau mot de passe', 'new-password')}
        {input('confirm', 'Confirmer le nouveau mot de passe', 'new-password')}

        <ul className="space-y-1">
          {rules.map((r) => (
            <li key={r.label} className={`text-xs flex items-center gap-2 ${r.ok ? 'text-green-700' : 'text-gray-500'}`}>
              <span className={`w-2 h-2 rounded-full ${r.ok ? 'bg-green-500' : 'bg-gray-300'}`} />
              {r.label}
            </li>
          ))}
        </ul>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-salesforce-blue text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center gap-2"
          >
            <IconLock className="w-4 h-4" /> {saving ? 'Modification...' : 'Changer le mot de passe'}
          </button>
        </div>
      </form>
    </Card>
  )
}

// ---------- Composants ----------
const Card = ({ icon: Icon, title, action, children }) => (
  <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
    <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-salesforce-blue" />
        </span>
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      {action}
    </div>
    {children}
  </div>
)

const Field = ({ label, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
  </div>
)

export default Profile