import axios from 'axios'

const N8N_URL = import.meta.env.VITE_N8N_URL || 'http://localhost:5678'

const n8nClient = axios.create({
  baseURL: N8N_URL,
  headers: { 'Content-Type': 'application/json' },
})

export const submitCRA = async (craData) => {
  try {
    const response = await n8nClient.post('/webhook/cra/submit', craData)
    return { success: true, data: response.data }
  } catch (error) {
    console.error('Erreur soumission CRA:', error)
    return { success: false, error: error.response?.data?.message || 'Erreur' }
  }
}

export const validateCRA = async (validationData) => {
  try {
    const response = await n8nClient.post('/webhook/cra/validate', validationData)
    return { success: true, data: response.data }
  } catch (error) {
    console.error('Erreur validation CRA:', error)
    return { success: false, error: error.response?.data?.message || 'Erreur' }
  }
}

export default { submitCRA, validateCRA }