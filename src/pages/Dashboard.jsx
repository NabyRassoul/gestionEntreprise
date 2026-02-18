import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const Dashboard = () => {
  const { profile } = useAuth()
  const [stats, setStats] = useState({
    pendingCRA: 0,
    submittedThisMonth: false,
    totalProjects: 0,
    validatedCRA: 0,
    rejectedCRA: 0,
    totalUsers: 0,
    totalAssignments: 0,
    monthlyStats: []
  })

  useEffect(() => {
    loadStats()
  }, [profile])

  const loadStats = async () => {
    if (!profile) return

    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()

    // CRA du mois en cours de l'utilisateur
    const { data: myCRA } = await supabase
      .from('cra_submissions')
      .select('*')
      .eq('user_id', profile.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .single()

    let pendingCount = 0
    let validatedCount = 0
    let rejectedCount = 0
    let totalUsers = 0
    let totalAssignments = 0
    let monthlyStats = []

    // Stats pour managers/admins
    if (profile.role === 'admin' || profile.role === 'manager') {
      // CRA par statut
      const { data: pending } = await supabase
        .from('cra_submissions')
        .select('id')
        .eq('status', 'submitted')
      
      const { data: validated } = await supabase
        .from('cra_submissions')
        .select('id')
        .eq('status', 'validated')
      
      const { data: rejected } = await supabase
        .from('cra_submissions')
        .select('id')
        .eq('status', 'rejected')
      
      pendingCount = pending?.length || 0
      validatedCount = validated?.length || 0
      rejectedCount = rejected?.length || 0

      // Total utilisateurs
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .eq('is_active', true)
      
      totalUsers = users?.length || 0

      // Total assignations
      const { data: assignments } = await supabase
        .from('project_assignments')
        .select('id')
      
      totalAssignments = assignments?.length || 0

      // Stats mensuelles (6 derniers mois)
      const monthsData = []
      for (let i = 5; i >= 0; i--) {
        const date = new Date()
        date.setMonth(date.getMonth() - i)
        const month = date.getMonth() + 1
        const year = date.getFullYear()

        const { data: monthCRAs } = await supabase
          .from('cra_submissions')
          .select('status')
          .eq('month', month)
          .eq('year', year)

        const submitted = monthCRAs?.filter(c => c.status === 'submitted').length || 0
        const validated = monthCRAs?.filter(c => c.status === 'validated').length || 0
        const rejected = monthCRAs?.filter(c => c.status === 'rejected').length || 0

        monthsData.push({
          name: date.toLocaleDateString('fr-FR', { month: 'short' }),
          'En attente': submitted,
          'Validés': validated,
          'Rejetés': rejected
        })
      }
      monthlyStats = monthsData
    }

    // Projets assignés à l'utilisateur
    const { data: projects } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('user_id', profile.id)

    setStats({
      pendingCRA: pendingCount,
      submittedThisMonth: !!myCRA,
      totalProjects: projects?.length || 0,
      validatedCRA: validatedCount,
      rejectedCRA: rejectedCount,
      totalUsers,
      totalAssignments,
      monthlyStats
    })
  }

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager' || isAdmin
  const isCollaborator = profile?.role === 'collaborator' || isManager

  // Données pour le graphique en secteurs (CRA)
  const craStatusData = [
    { name: 'En attente', value: stats.pendingCRA, color: '#FFB75D' },
    { name: 'Validés', value: stats.validatedCRA, color: '#04844B' },
    { name: 'Rejetés', value: stats.rejectedCRA, color: '#C23934' }
  ].filter(item => item.value > 0)

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
      show: isCollaborator && !isAdmin,
      title: 'Mes CRA',
      description: 'Consultez l\'historique de vos CRA',
      icon: '📊',
      path: '/cra/history',
      color: 'salesforce-blue',
      badge: { text: `${stats.totalProjects} projets`, color: 'blue' }
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
      show: isManager,
      title: 'Gestion des CRA',
      description: 'Validez ou rejetez les CRA de votre équipe',
      icon: '📝',
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

      {/* Stats pour Managers/Admins */}
      {isManager && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="card">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">CRA en attente</p>
                    <p className="text-3xl font-bold text-yellow-600">{stats.pendingCRA}</p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">⏳</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">CRA validés</p>
                    <p className="text-3xl font-bold text-green-600">{stats.validatedCRA}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">✅</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Collaborateurs</p>
                    <p className="text-3xl font-bold text-salesforce-blue">{stats.totalUsers}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">👥</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Assignations</p>
                    <p className="text-3xl font-bold text-purple-600">{stats.totalAssignments}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">🔗</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Graphiques */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Graphique en secteurs - Répartition des CRA */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-900">Répartition des CRA</h3>
              </div>
              <div className="card-body">
                {craStatusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={craStatusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {craStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-gray-500">
                    Aucun CRA pour le moment
                  </div>
                )}
              </div>
            </div>

            {/* Graphique en barres - Évolution mensuelle */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-900">Évolution sur 6 mois</h3>
              </div>
              <div className="card-body">
                {stats.monthlyStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={stats.monthlyStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Validés" fill="#04844B" />
                      <Bar dataKey="En attente" fill="#FFB75D" />
                      <Bar dataKey="Rejetés" fill="#C23934" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-gray-500">
                    Aucune donnée disponible
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
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