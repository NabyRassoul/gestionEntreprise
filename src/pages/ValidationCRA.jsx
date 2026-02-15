import { useState, useEffect } from 'react'
import { getPendingCRAs } from '../services/supabase'
import { validateCRA } from '../services/n8n'
import { useAuth } from '../contexts/AuthContext'

const ValidationCRA = () => {
  const { user } = useAuth()
  const [cras, setCRAs] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadCRAs()
  }, [])

  const loadCRAs = async () => {
    const { data } = await getPendingCRAs()
    if (data) setCRAs(data)
    setLoading(false)
  }

  const handleValidate = async (craId) => {
    const result = await validateCRA({
      cra_id: craId,
      manager_id: user.id,
      action: 'validated'
    })

    if (result.success) {
      setMessage({ type: 'success', text: 'CRA validé !' })
      loadCRAs()
    } else {
      setMessage({ type: 'error', text: 'Erreur' })
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
    } else {
      setMessage({ type: 'error', text: 'Erreur' })
    }
  }

  if (loading) return <div className="p-6">Chargement...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Validation des CRA</h1>

        {message && (
          <div className={`mb-4 p-3 rounded ${message.type === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
            {message.text}
          </div>
        )}

        {cras.length === 0 ? (
          <div className="bg-white rounded-lg p-6 text-center">
            <p className="text-gray-600">Aucun CRA en attente</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cras.map(cra => (
              <div key={cra.id} className="bg-white rounded-lg p-6 shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{cra.user?.first_name} {cra.user?.last_name}</h3>
                    <p className="text-gray-600">{cra.user?.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{cra.month}/{cra.year}</p>
                    <p className="text-sm text-gray-600">
                      {cra.entries?.reduce((sum, e) => sum + parseFloat(e.days_worked), 0)} jours
                    </p>
                  </div>
                </div>

                <table className="w-full mb-4 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Projet</th>
                      <th className="px-3 py-2 text-left">Jours</th>
                      <th className="px-3 py-2 text-left">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cra.entries?.map((entry, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2">{entry.project?.name}</td>
                        <td className="px-3 py-2">{entry.days_worked}</td>
                        <td className="px-3 py-2">{entry.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex gap-3 justify-end">
                  <button onClick={() => handleReject(cra.id)} className="px-4 py-2 border border-red-300 text-red-700 rounded hover:bg-red-50">
                    ❌ Rejeter
                  </button>
                  <button onClick={() => handleValidate(cra.id)} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                    ✅ Valider
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ValidationCRA