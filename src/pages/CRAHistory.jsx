import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'

const CRAHistory = () => {
  const { user } = useAuth()
  const [cras, setCRAs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCRA, setSelectedCRA] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => {
    loadCRAs()
  }, [user])

  const loadCRAs = async () => {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('cra_submissions')
      .select(`
        *,
        entries:cra_entries(
          *,
          project:projects(name, code, client)
        ),
        validator:users!validated_by(first_name, last_name)
      `)
      .eq('user_id', user.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    if (!error && data) {
      setCRAs(data)
    }
    
    setLoading(false)
  }

  const getStatusBadge = (status) => {
    const badges = {
      draft: { color: 'gray', text: 'Brouillon' },
      submitted: { color: 'yellow', text: 'En attente' },
      validated: { color: 'green', text: 'Validé' },
      rejected: { color: 'red', text: 'Rejeté' }
    }
    const badge = badges[status] || badges.draft
    return (
      <span className={`badge badge-${badge.color}`}>
        {badge.text}
      </span>
    )
  }

  const getMonthName = (month) => {
    const months = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ]
    return months[month - 1] || month
  }

  const getTotalDays = (entries) => {
    return entries?.reduce((sum, entry) => sum + parseFloat(entry.days_worked || 0), 0) || 0
  }

  const handleViewDetails = (cra) => {
    setSelectedCRA(cra)
    setShowDetailModal(true)
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Mes CRA</h1>
        <p className="text-gray-600">Historique de vos comptes rendus d'activité</p>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-600 mb-1">Total CRA</p>
            <p className="text-2xl font-bold text-gray-900">{cras.length}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-600 mb-1">Validés</p>
            <p className="text-2xl font-bold text-salesforce-success">
              {cras.filter(c => c.status === 'validated').length}
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-600 mb-1">En attente</p>
            <p className="text-2xl font-bold text-salesforce-warning">
              {cras.filter(c => c.status === 'submitted').length}
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-600 mb-1">Rejetés</p>
            <p className="text-2xl font-bold text-salesforce-error">
              {cras.filter(c => c.status === 'rejected').length}
            </p>
          </div>
        </div>
      </div>

      {/* Liste des CRA */}
      {cras.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Aucun CRA pour le moment
            </h3>
            <p className="text-gray-600 mb-6">
              Commencez par soumettre votre premier compte rendu d'activité
            </p>
            <a
              href="/cra/submit"
              className="btn-primary inline-block"
            >
              Soumettre un CRA
            </a>
          </div>
        </div>
      ) : (
        <div className="card">
          <table className="table-salesforce">
            <thead>
              <tr>
                <th>Période</th>
                <th>Projets</th>
                <th>Total jours</th>
                <th>Statut</th>
                <th>Soumis le</th>
                <th>Validé par</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cras.map((cra) => (
                <tr key={cra.id}>
                  <td>
                    <div className="font-medium text-gray-900">
                      {getMonthName(cra.month)} {cra.year}
                    </div>
                  </td>
                  <td>
                    <div className="text-sm text-gray-600">
                      {cra.entries?.length || 0} projet(s)
                    </div>
                  </td>
                  <td>
                    <div className="font-medium">
                      {getTotalDays(cra.entries)} jours
                    </div>
                  </td>
                  <td>
                    {getStatusBadge(cra.status)}
                  </td>
                  <td>
                    <div className="text-sm text-gray-600">
                      {cra.submitted_at
                        ? new Date(cra.submitted_at).toLocaleDateString('fr-FR')
                        : '-'}
                    </div>
                  </td>
                  <td>
                    <div className="text-sm text-gray-600">
                      {cra.validator
                        ? `${cra.validator.first_name} ${cra.validator.last_name}`
                        : '-'}
                    </div>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => handleViewDetails(cra)}
                      className="text-salesforce-blue hover:text-salesforce-dark-blue font-medium text-sm"
                    >
                      👁️ Voir détails
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal détails */}
      {showDetailModal && selectedCRA && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header modal */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  CRA - {getMonthName(selectedCRA.month)} {selectedCRA.year}
                </h2>
                <div className="mt-1">
                  {getStatusBadge(selectedCRA.status)}
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Contenu modal */}
            <div className="p-6">
              {/* Informations générales */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 uppercase mb-3">
                  Informations
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Soumis le</p>
                    <p className="font-medium">
                      {selectedCRA.submitted_at
                        ? new Date(selectedCRA.submitted_at).toLocaleString('fr-FR')
                        : 'Non soumis'}
                    </p>
                  </div>
                  {selectedCRA.validated_at && (
                    <div>
                      <p className="text-sm text-gray-600">Validé le</p>
                      <p className="font-medium">
                        {new Date(selectedCRA.validated_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  )}
                  {selectedCRA.validator && (
                    <div>
                      <p className="text-sm text-gray-600">Validé par</p>
                      <p className="font-medium">
                        {selectedCRA.validator.first_name} {selectedCRA.validator.last_name}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">Total jours</p>
                    <p className="font-medium text-lg">
                      {getTotalDays(selectedCRA.entries)} jours
                    </p>
                  </div>
                </div>
              </div>

              {/* Raison de rejet */}
              {selectedCRA.status === 'rejected' && selectedCRA.rejection_reason && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-semibold text-red-900 mb-1">
                    Raison du rejet
                  </p>
                  <p className="text-sm text-red-700">
                    {selectedCRA.rejection_reason}
                  </p>
                </div>
              )}

              {/* Détail des activités */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase mb-3">
                  Activités par projet
                </h3>
                <div className="space-y-4">
                  {selectedCRA.entries?.map((entry, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            {entry.project?.name}
                          </h4>
                          <p className="text-sm text-gray-600">
                            Code : {entry.project?.code}
                            {entry.project?.client && ` • Client : ${entry.project.client}`}
                          </p>
                        </div>
                        <span className="badge badge-blue">
                          {entry.days_worked} jour{entry.days_worked > 1 ? 's' : ''}
                        </span>
                      </div>
                      {entry.description && (
                        <div className="mt-2 p-3 bg-gray-50 rounded text-sm text-gray-700">
                          {entry.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer modal */}
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="btn-secondary"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CRAHistory