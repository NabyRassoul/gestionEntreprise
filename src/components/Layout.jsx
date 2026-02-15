import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { signOut } from '../services/supabase'

const Layout = ({ children }) => {
  const { profile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager' || isAdmin
  const isCollaborator = profile?.role === 'collaborator' || isManager

  const navigation = [
    {
      name: 'Tableau de bord',
      path: '/dashboard',
      icon: '🏠',
      show: true
    },
    {
      name: 'Soumettre mon CRA',
      path: '/cra/submit',
      icon: '📝',
      show: isCollaborator && !isAdmin
    },
    {
      name: 'Mes CRA',
      path: '/cra/history',
      icon: '📊',
      show: isCollaborator
    },
    {
      name: 'Valider les CRA',
      path: '/admin/validation',
      icon: '✅',
      show: isManager
    },
    {
      name: 'Gestion des Projets',
      path: '/admin/projects',
      icon: '📁',
      show: isManager
    },
    {
      name: 'Attribution Projets',
      path: '/admin/assignments',
      icon: '🔗',
      show: isManager
    },
    {
      name: 'Gestion Utilisateurs',
      path: '/admin/users',
      icon: '👥',
      show: isAdmin
    }
  ]

  const isActive = (path) => location.pathname === path

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-30 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-salesforce-blue rounded flex items-center justify-center text-white font-bold">
                C
              </div>
              <span className="font-semibold text-gray-900">CRA Manager</span>
            </div>
          ) : (
            <div className="w-8 h-8 bg-salesforce-blue rounded flex items-center justify-center text-white font-bold mx-auto">
              C
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-gray-100 rounded"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {navigation.filter(item => item.show).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive(item.path)
                  ? 'bg-salesforce-blue text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {sidebarOpen && <span className="font-medium">{item.name}</span>}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div
        className={`transition-all duration-300 ${
          sidebarOpen ? 'ml-64' : 'ml-20'
        }`}
      >
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900">
              {navigation.find(n => n.path === location.pathname)?.name || 'CRA Manager'}
            </h1>
          </div>

          {/* Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 bg-salesforce-blue rounded-full flex items-center justify-center text-white font-semibold">
                {profile?.first_name?.[0]}{profile?.last_name?.[0]}
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-gray-900">
                  {profile?.first_name} {profile?.last_name}
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  {profile?.role}
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-900">
                    {profile?.email}
                  </div>
                  <div className="text-xs text-gray-500">
                    {profile?.department}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  🚪 Déconnexion
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {children}
        </main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}

export default Layout