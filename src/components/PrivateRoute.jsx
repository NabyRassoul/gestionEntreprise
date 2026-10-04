import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * <PrivateRoute>                         → connecté obligatoire
 * <PrivateRoute roles={['admin']}>       → + rôle autorisé, sinon retour au dashboard
 */
const PrivateRoute = ({ children, roles }) => {
  const { isAuthenticated, loading, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-gray-500">
        <svg className="w-8 h-8 animate-spin text-salesforce-blue" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" className="opacity-75" />
        </svg>
        <p className="text-sm">Chargement de votre session...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && !roles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default PrivateRoute