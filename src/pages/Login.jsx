import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Alert from '@mui/material/Alert'
import { IconClipboard, IconCalendar, IconCheck, IconLeave, IconWarning, IconMail, IconLock, IconEye, IconEyeOff } from '../components/Icons'
const APP_NAME = 'Gestion des CRA'
const COMPANY = 'PularTech'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated } = useAuth()
  const from = location.state?.from?.pathname || '/dashboard'

  // Déjà connecté → on ne reste pas sur /login
  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true })
  }, [isAuthenticated])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email.trim().toLowerCase(), password, remember)
      navigate(from, { replace: true })
    } catch (err) {
      if (err.code === 'network') setError('Serveur injoignable. Vérifiez votre connexion ou réessayez dans un instant.')
      else if (/disabled/i.test(err.message)) setError('Votre compte est désactivé. Contactez votre administrateur.')
      else setError('Email ou mot de passe incorrect.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-gray-50">
      {/* Panneau de marque */}
      <div className="hidden lg:flex flex-col justify-between p-12 text-white bg-gradient-to-br from-[#0176d3] via-[#014486] to-[#032d60] relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-20 w-[28rem] h-[28rem] rounded-full bg-white/5" />

        <div className="relative flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center"><IconClipboard className="w-6 h-6" /></div>
          <div>
            <p className="text-lg font-bold leading-tight">{APP_NAME}</p>
            <p className="text-xs text-blue-100">{COMPANY}</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Vos comptes rendus d'activité, simplement.
          </h1>
          <p className="text-blue-100 mb-10">
            Saisissez vos jours, suivez vos projets et faites valider vos CRA en quelques clics.
          </p>
          <ul className="space-y-4">
            {[
              [IconCalendar, 'Saisie au calendrier', 'Journées et demi-journées, par projet'],
              [IconCheck, 'Validation manager', 'Suivi en temps réel des CRA soumis'],
              [IconLeave, 'Congés & jours fériés', 'Pris en compte automatiquement'],
            ].map(([Icon, title, text]) => (
              <li key={title} className="flex items-start gap-3">
                 <span className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5" /></span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-blue-100">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-blue-200">© {new Date().getFullYear()} {COMPANY}</p>
      </div>

      {/* Formulaire */}
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-lg bg-salesforce-blue text-white flex items-center justify-center"><IconClipboard className="w-6 h-6" /></div>
            <p className="text-lg font-bold text-gray-900">{APP_NAME}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900">Connexion</h2>
            <p className="text-sm text-gray-500 mt-1 mb-6">Accédez à votre espace</p>

                        {error && <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert>}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <div className="relative">
                    <IconMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="prenom.nom@entreprise.com"
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                <div className="relative">
                  <IconLock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="password"
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                                    <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-salesforce-blue"
                    tabIndex={-1}
                    title={showPwd ? 'Masquer' : 'Afficher'}
                  >
                    {showPwd ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-salesforce-blue focus:ring-blue-500"
                />
                Se souvenir de moi
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-salesforce-blue text-white font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60 transition"
              >
                {loading && (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" className="opacity-75" />
                  </svg>
                )}
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-gray-500">
              Mot de passe oublié ? Contactez votre administrateur.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}