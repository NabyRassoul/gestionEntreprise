import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'

const Dashboard = () => {
  const { profile } = useAuth()
  const [stats, setStats] = useState({
    pendingCRA: 0,
    submittedThisMonth: false,
    totalProjects: 0
  })

  useEffect(() => {
    loadStats()
  }, [profile])

  const loadStats = async () => {
    if (!profile) return

    // CRA du mois en cours
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()

    const { data: myCRA } = await supabase
      .from('cra_submissions')
      .select('*')
      .eq('user_id', profile.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .single()

    // CRA en attente (pour managers/admins)
    let pendingCount = 0
    if (profile.role === 'admin' || profile.role === 'manager') {
      const { data: pending } = await supabase
        .from('cra_submissions')
        .select('id')
        .eq('status', 'submitted')
      
      pendingCount = pending?.length || 0
    }

    // Projets assignés
    const { data: projects } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('user_id', profile.id)

    setStats({
      pendingCRA: pendingCount,
      submittedThisMonth: !!myCRA,
      totalProjects: projects?.length || 0
    })
  }

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager' || isAdmin
  const isCollaborator = profile?.role === 'collaborator' || isManager

  const cards = [
    {
      show: isCollaborator && !isAdmin,
      title: 'Soumettre mon CRA',
      description: 'Remplissez votre compte rendu d\'activité mensuel',
      icon: '📝',
      path: '/cra/submit',
      color: 'salesforce-blue',
      badge: stats.submittedThisMonth ? { text: 'Déjà soumis ce mois', color: 'green' } : null
    },
    {
      show: isCollaborator,
      title: 'Mes CRA',
      description: 'Consultez l\'historique de vos CRA',
      icon: '📊',
      path: '/cra/history',
      color: 'salesforce-blue',
      badge: { text: `${stats.totalProjects} projets`, color: 'blue' }
    },
    {
      show: isManager,
      title: 'Valider les CRA',
      description: 'Validez ou rejetez les CRA de votre équipe',
      icon: '✅',
      path: '/admin/validation',
      color: 'salesforce-success',
      badge: stats.pendingCRA > 0 ? { text: `${stats.pendingCRA} en attente`, color: 'yellow' } : null
    },
    {
      show: isManager,
      title: 'Gestion des Projets',
      description: 'Créer, modifier et gérer les projets',
      icon: '📁',
      path: '/admin/projects',
      color: 'salesforce-blue'
    },
    {
      show: isManager,
      title: 'Attribution Projets',
      description: 'Assigner des projets aux collaborateurs',
      icon: '🔗',
      path: '/admin/assignments',
      color: 'salesforce-blue'
    },
    {
      show: isAdmin,
      title: 'Gestion Utilisateurs',
      description: 'Créer et gérer les comptes utilisateurs',
      icon: '👥',
      path: '/admin/users',
      color: 'salesforce-blue'
    }
  ]

  return (
    <div>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Bienvenue, {profile?.first_name} ! 👋
        </h1>
        <p className="text-gray-600">
          {profile?.role === 'admin' && 'Vous avez accès à toutes les fonctionnalités administrateur'}
          {profile?.role === 'manager' && 'Gérez votre équipe et validez les CRA'}
          {profile?.role === 'collaborator' && 'Soumettez vos CRA et suivez vos projets'}
        </p>
      </div>

      {/* Quick Stats */}
      {isManager && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">CRA en attente</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.pendingCRA}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">⏳</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.filter(card => card.show).map((card, index) => (
          <Link
            key={index}
            to={card.path}
            className="card hover:shadow-salesforce-lg transition-shadow group"
          >
            <div className="card-body">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 bg-${card.color} bg-opacity-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <span className="text-2xl">{card.icon}</span>
                </div>
                {card.badge && (
                  <span className={`badge badge-${card.badge.color}`}>
                    {card.badge.text}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {card.title}
              </h3>
              <p className="text-sm text-gray-600">
                {card.description}
              </p>
              <div className="mt-4 flex items-center text-salesforce-blue text-sm font-medium">
                Accéder
                <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default Dashboard