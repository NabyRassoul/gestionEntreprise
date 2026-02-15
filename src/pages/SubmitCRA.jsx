import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getUserProjects } from '../services/supabase'
import { submitCRA } from '../services/n8n'

const SubmitCRA = () => {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    const { data } = await getUserProjects(user.id)
    if (data) {
      const projectList = data.map(pa => pa.project)
      setProjects(projectList)
      setEntries(projectList.map(p => ({
        project_id: p.id,
        days_worked: 0,
        description: ''
      })))
    }
  }

  const handleEntryChange = (projectId, field, value) => {
    setEntries(prev => prev.map(entry =>
      entry.project_id === projectId ? { ...entry, [field]: value } : entry
    ))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const validEntries = entries.filter(e => parseFloat(e.days_worked) > 0)

    if (validEntries.length === 0) {
      setMessage({ type: 'error', text: 'Renseignez au moins un projet' })
      setLoading(false)
      return
    }

    const result = await submitCRA({
      user_id: user.id,
      month,
      year,
      entries: validEntries
    })

    if (result.success) {
      setMessage({ type: 'success', text: 'CRA soumis avec succès !' })
      setEntries(projects.map(p => ({ project_id: p.id, days_worked: 0, description: '' })))
    } else {
      setMessage({ type: 'error', text: 'Erreur lors de la soumission' })
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">Soumettre mon CRA</h1>

        {message && (
          <div className={`mb-4 p-3 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6 flex gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Mois</label>
              <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="border rounded px-3 py-2">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Année</label>
              <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="border rounded px-3 py-2">
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <table className="w-full mb-6">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Projet</th>
                <th className="px-4 py-2 text-left">Jours</th>
                <th className="px-4 py-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={idx} className="border-t">
                  <td className="px-4 py-2">{projects.find(p => p.id === entry.project_id)?.name}</td>
                  <td className="px-4 py-2">
                    <input type="number" step="0.5" value={entry.days_worked} onChange={(e) => handleEntryChange(entry.project_id, 'days_worked', e.target.value)} className="border rounded px-2 py-1 w-20" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="text" value={entry.description} onChange={(e) => handleEntryChange(entry.project_id, 'description', e.target.value)} className="border rounded px-2 py-1 w-full" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Envoi...' : 'Soumettre'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default SubmitCRA