import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import NotificationBell from './NotificationBell'
import {
  IconHome, IconLink, IconEdit, IconHistory, IconCheck, IconFolder, IconUsers, IconHoliday,
  IconChevronLeft, IconChevronRight, IconChevronDown, IconLogout,IconUser,IconSettings,IconLeave,
} from './Icons'
const Layout = ({ children }) => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showuserMenu, setShowuserMenu] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isAdmin = user?.role === 'admin'
  const isManager = user?.role === 'manager' || isAdmin
  const isCollaborator = user?.role === 'collaborator' || isManager

  const navigation = [
    {
      name: 'Tableau de bord',
      path: '/dashboard',
      icon: IconHome,
      show: true
    },
    {
      name: 'Attribution Projets',
      path: '/admin/assignments',
      icon: IconLink,
      show: isManager
    },
    {
      name: 'Soumettre mon CRA',
      path: '/cra/submit',
      icon: IconEdit,
      show: isCollaborator && !isAdmin
    },
    {
      name: 'Mes CRA',
      path: '/cra/history',
      icon: IconHistory,
      show: isCollaborator && !isAdmin
    },
    {
      name: 'Gestion des CRA',
      path: '/admin/validation',
      icon: IconCheck,
      show: isManager
    },
    {
      name: 'Gestion des Projets',
      path: '/admin/projects',
      icon: IconFolder,
      show: isManager
    },
    {
      name: 'Gestion Utilisateurs',
      path: '/admin/users',
      icon: IconUsers,
      show: isAdmin
    },
      { name: 'Jours fériés', 
        path: '/admin/holidays', 
        icon: IconHoliday, 
        show: isAdmin },
    { name: 'Mon profil', 
      path: '/profile', 
      icon: IconUser, 
      show: false },

    { name: 'Paramètres absences', 
      path: '/admin/leave-settings',
       icon: IconSettings, 
       show: isAdmin },
        { name: 'Mes absences', 
          path: '/leaves', 
          icon: IconLeave, 
          show: true },
      { name: 'Absences équipe', path: '/admin/leaves', icon: IconLeave, show: isManager },
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
                TT
              </div>
              <span className="font-semibold text-gray-900">TeamTrack</span>
            </div>
          ) : (
            <div className="w-8 h-8 bg-salesforce-blue rounded flex items-center justify-center text-white font-bold mx-auto">
              TT
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-gray-100 rounded"
          >
                        {sidebarOpen ? <IconChevronLeft className="w-4 h-4" /> : <IconChevronRight className="w-4 h-4" />}
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
                            <item.icon className="w-5 h-5 flex-shrink-0" />
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
              
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-40">
          <h1 className="text-xl font-semibold text-gray-900">
            {navigation.find((n) => n.path === location.pathname)?.name || 'CRA Manager'}
          </h1>

          <div className="flex items-center gap-2">
            <NotificationBell />

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowuserMenu(!showuserMenu)}
                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 bg-salesforce-blue rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-medium text-gray-900">
                    {user?.first_name} {user?.last_name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {{ admin: 'Administrateur', manager: 'Manager', collaborator: 'Collaborateur' }[user?.role] || user?.role}
                  </div>
                </div>
                                <IconChevronDown className="w-4 h-4 text-gray-500" />
              </button>

              {showuserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowuserMenu(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <div className="text-sm font-medium text-gray-900 truncate">{user?.email}</div>
                      <div className="text-xs text-gray-500">{user?.department || '—'}</div>
                    </div>
                                        <Link
                      to="/profile"
                      onClick={() => setShowuserMenu(false)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <IconUser className="w-4 h-4" /> Mon profil
                    </Link>
                    <button
                      onClick={handleLogout}
                                           className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                      <IconLogout className="w-4 h-4" /> Déconnexion
                    </button>
                  </div>
                </>
              )}
            </div>
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