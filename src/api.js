const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const TOKEN_KEY = 'auth_token'

const getToken = () => localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.status = status
    this.data = data
  }
}

// Transforme une réponse d'erreur Django/DRF en message lisible
const extractMessage = (data, status) => {
  if (!data) return `Erreur ${status}`
  if (typeof data === 'string') return data
  if (data.error) return data.error
  if (data.detail) return data.detail
  const first = Object.entries(data)[0]
  return first ? `${first[0]} : ${[].concat(first[1]).join(' ')}` : `Erreur ${status}`
}

async function request(method, path, { body, params } = {}) {
  const url = new URL(`${API_URL}/api${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
    })
  }

  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Token ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  } catch {
    throw new ApiError('Serveur injoignable', 0)
  }

  // Token expiré ou révoqué → déconnexion globale
  if (res.status === 401) {
    window.dispatchEvent(new Event('auth:unauthorized'))
    throw new ApiError('Session expirée, reconnectez-vous', 401)
  }

  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(extractMessage(data, res.status), res.status, data)
  return data
}

const asList = (data) => (Array.isArray(data) ? data : data?.results || [])

// Telechargement de ficher pdf et excel

async function download(path, params, fallbackName = 'export') {
  const url = new URL(`${API_URL}/api${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
    })
  }
  const token = getToken()
  let res
  try {
    res = await fetch(url, { headers: token ? { Authorization: `Token ${token}` } : {} })
  } catch {
    throw new ApiError('Serveur injoignable', 0)
  }
  if (res.status === 401) {
    window.dispatchEvent(new Event('auth:unauthorized'))
    throw new ApiError('Session expirée, reconnectez-vous', 401)
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new ApiError(extractMessage(data, res.status), res.status, data)
  }
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') || ''
  const name = /filename="?([^"]+)"?/.exec(cd)?.[1] || fallbackName

  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

const api = {
  get: (path, params) => request('GET', path, { params }),
  list: async (path, params) => asList(await request('GET', path, { params })),
  post: (path, body) => request('POST', path, { body: body ?? {} }),
  patch: (path, body) => request('PATCH', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  delete: (path) => request('DELETE', path),
    download,
}

export default api