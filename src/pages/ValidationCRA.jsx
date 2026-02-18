import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { validateCRA } from '../services/n8n'
import { useAuth } from '../contexts/AuthContext'

const ValidationCRA = () => {
  const { user } = useAuth()
  const [cras, setCRAs] = useState([])
  const [filterStatus, setFilterStatus] = useState('all') // all, submitted, validated, rejected
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadCRAs()
  }, [])

  const loadCRAs = async () => {
    // Charger TOUS les CRA (pas seulement pending)
    const { data } = await supabase
      .from('cra_submissions')
      .select(`
        *,
        user:users!user_id(id, first_name, last_name, email, department),
        entries:cra_entries(*, project:projects(name, code)),
        validator:users!validated_by(first_name, last_name)
      `)
      .in('status', ['submitted', 'validated', 'rejected'])
      .order('submitted_at', { ascending: false })

    if (data) setCRAs(data)
    setLoading(false)
  }

  const handleValidate = async (craId) => {
    if (!confirm('Êtes-vous sûr de vouloir valider ce CRA ?')) return

    const result = await validateCRA({
      cra_id: craId,
      manager_id: user.id,
      action: 'validated'
    })

    if (result.success) {
      setMessage({ type: 'success', text: 'CRA validé !' })
      loadCRAs()
      setTimeout(() => setMessage(null), 3000)
    } else {
      setMessage({ type: 'error', text: 'Erreur lors de la validation' })
    }
  }

  const handleReject = async (craId) => {
    const reason = prompt('Raison du rejet :')
    if (!reason) return

    const result = await validateCRA({
      cra_id: craId,
      manager_id: user.id,
      action: 'rejected',
      rejection_reason: reason
    })

    if (result.success) {
      setMessage({ type: 'success', text: 'CRA rejeté' })
      loadCRAs()
      setTimeout(() => setMessage(null), 3000)
    } else {
      setMessage({ type: 'error', text: 'Erreur lors du rejet' })
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      submitted: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', text: '⏳ En attente' },
      validated: { color: 'bg-green-100 text-green-800 border-green-300', text: '✅ Validé' },
      rejected: { color: 'bg-red-100 text-red-800 border-red-300', text: '❌ Rejeté' }
    }
    const badge = badges[status] || badges.submitted
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${badge.color}`}>
        {badge.text}
      </span>
    )
  }

  const getCardStyle = (status) => {
    const styles = {
      submitted: 'border-l-4 border-l-yellow-500',
      validated: 'border-l-4 border-l-green-500',
      rejected: 'border-l-4 border-l-red-500'
    }
    return styles[status] || ''
  }

  const filteredCRAs = cras.filter(cra => {
    if (filterStatus === 'all') return true
    return cra.status === filterStatus
  })

  const stats = {
    submitted: cras.filter(c => c.status === 'submitted').length,
    validated: cras.filter(c => c.status === 'validated').length,
    rejected: cras.filter(c => c.status === 'rejected').length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Chargement...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Validation des CRA</h1>
        <p className="text-gray-600">Gérez les comptes rendus d'activité de votre équipe</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => setFilterStatus('all')}
          className={`card hover:shadow-md transition-shadow ${filterStatus === 'all' ? 'ring-2 ring-salesforce-blue' : ''}`}
        >
          <div className="card-body">
            <p className="text-sm text-gray-600 mb-1">Total CRA</p>
            <p className="text-2xl font-bold text-gray-900">{cras.length}</p>
          </div>
        </button>

        <button
          onClick={() => setFilterStatus('submitted')}
          className={`card hover:shadow-md transition-shadow ${filterStatus === 'submitted' ? 'ring-2 ring-yellow-500' : ''}`}
        >
          <div className="card-body">
            <p className="text-sm text-gray-600 mb-1">En attente</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.submitted}</p>
          </div>
        </button>

        <button
          onClick={() => setFilterStatus('validated')}
          className={`card hover:shadow-md transition-shadow ${filterStatus === 'validated' ? 'ring-2 ring-green-500' : ''}`}
        >
          <div className="card-body">
            <p className="text-sm text-gray-600 mb-1">Validés</p>
            <p className="text-2xl font-bold text-green-600">{stats.validated}</p>
          </div>
        </button>

        <button
          onClick={() => setFilterStatus('rejected')}
          className={`card hover:shadow-md transition-shadow ${filterStatus === 'rejected' ? 'ring-2 ring-red-500' : ''}`}
        >
          <div className="card-body">
            <p className="text-sm text-gray-600 mb-1">Rejetés</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          </div>
        </button>
      </div>

      {/* Liste des CRA */}
      {filteredCRAs.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {filterStatus === 'all' ? 'Aucun CRA' : `Aucun CRA ${filterStatus === 'submitted' ? 'en attente' : filterStatus === 'validated' ? 'validé' : 'rejeté'}`}
            </h3>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="divide-y divide-gray-200">
            {filteredCRAs.map(cra => (
              <CRARow key={cra.id} cra={cra} onValidate={handleValidate} onReject={handleReject} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Composant de ligne CRA avec expand/collapse
const CRARow = ({ cra, onValidate, onReject }) => {
  const [expanded, setExpanded] = useState(false)

  const getStatusBadge = (status) => {
    const badges = {
      submitted: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', text: '⏳ En attente' },
      validated: { color: 'bg-green-100 text-green-800 border-green-300', text: '✅ Validé' },
      rejected: { color: 'bg-red-100 text-red-800 border-red-300', text: '❌ Rejeté' }
    }
    const badge = badges[status] || badges.submitted
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${badge.color}`}>
        {badge.text}
      </span>
    )
  }

  const getBorderColor = (status) => {
    const colors = {
      submitted: 'border-l-yellow-500',
      validated: 'border-l-green-500',
      rejected: 'border-l-red-500'
    }
    return colors[status] || 'border-l-gray-300'
  }

  const totalDays = cra.entries?.reduce((sum, e) => sum + parseFloat(e.days_worked), 0) || 0

  return (
    <div className={`border-l-4 ${getBorderColor(cra.status)} hover:bg-gray-50 transition-colors`}>
      {/* Ligne compacte */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Info utilisateur */}
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 hover:text-gray-600 transition-transform"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>

            <div className="flex-1">
              <h3 className="font-bold text-gray-900">
                {cra.user?.first_name} {cra.user?.last_name}
              </h3>
              <p className="text-sm text-gray-600">{cra.user?.email}</p>
              {cra.user?.department && (
                <span className="inline-block mt-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                  {cra.user.department}
                </span>
              )}
            </div>
          </div>

          {/* Badge et infos */}
          <div className="flex items-center gap-6">
            {getStatusBadge(cra.status)}
            
            <div className="text-right">
              <p className="font-semibold text-gray-900">{cra.month}/{cra.year}</p>
              <p className="text-sm text-gray-600">Total : {totalDays} jours</p>
            </div>

            {/* Boutons d'action */}
            {cra.status === 'submitted' && (
              <div className="flex gap-2">
                <button
                  onClick={() => onReject(cra.id)}
                  className="px-3 py-1.5 border-2 border-red-300 text-red-700 rounded hover:bg-red-50 text-sm font-medium transition-colors"
                >
                  ❌ Rejeter
                </button>
                <button
                  onClick={() => onValidate(cra.id)}
                  className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium transition-colors"
                >
                  ✅ Valider
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Détails expandables */}
      {expanded && (
        <div className="px-6 pb-4 border-t border-gray-200 bg-gray-50">
          <div className="pt-4">
            {/* Tableau des projets */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Projets</h4>
              <table className="w-full text-sm bg-white rounded border border-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Projet</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Jours</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {cra.entries?.map((entry, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{entry.project?.name}</div>
                        <div className="text-xs text-gray-500">{entry.project?.code}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="badge badge-blue">{entry.days_worked}j</span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {entry.description || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Infos supplémentaires */}
            <div className="grid grid-cols-3 gap-4 text-sm mb-4">
              <div className="bg-white p-3 rounded border border-gray-200">
                <span className="text-gray-600">Soumis le</span>
                <p className="font-semibold text-gray-900">
                  {cra.submitted_at ? new Date(cra.submitted_at).toLocaleDateString('fr-FR') : '-'}
                </p>
              </div>
              {cra.validated_at && (
                <div className="bg-white p-3 rounded border border-gray-200">
                  <span className="text-gray-600">
                    {cra.status === 'validated' ? 'Validé' : 'Rejeté'} le
                  </span>
                  <p className="font-semibold text-gray-900">
                    {new Date(cra.validated_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              )}
              {cra.validator && (
                <div className="bg-white p-3 rounded border border-gray-200">
                  <span className="text-gray-600">Par</span>
                  <p className="font-semibold text-gray-900">
                    {cra.validator.first_name} {cra.validator.last_name}
                  </p>
                </div>
              )}
            </div>

            {/* Raison du rejet */}
            {cra.status === 'rejected' && cra.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm font-semibold text-red-900 mb-1">Raison du rejet :</p>
                <p className="text-sm text-red-700">{cra.rejection_reason}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ValidationCRA