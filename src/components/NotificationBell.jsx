import api from '../api'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { IconBell, IconBellOff, IconFolder, IconNoSymbol, IconSend, IconCheck, IconX,IconLeave } from './Icons'
const POLL_MS = 30000
const TYPES = {
  project_assigned: { icon: IconFolder, bg: 'bg-blue-100', fg: 'text-blue-700' },
  project_removed: { icon: IconNoSymbol, bg: 'bg-gray-100', fg: 'text-gray-600' },
  cra_submitted: { icon: IconSend, bg: 'bg-yellow-100', fg: 'text-yellow-700' },
  cra_validated: { icon: IconCheck, bg: 'bg-green-100', fg: 'text-green-700' },
  cra_rejected: { icon: IconX, bg: 'bg-red-100', fg: 'text-red-700' },
  leave_submitted: { icon: IconLeave, bg: 'bg-purple-100', fg: 'text-purple-700' },
  leave_approved: { icon: IconCheck, bg: 'bg-green-100', fg: 'text-green-700' },
  leave_rejected: { icon: IconX, bg: 'bg-red-100', fg: 'text-red-700' },
  leave_cancelled: { icon: IconNoSymbol, bg: 'bg-gray-100', fg: 'text-gray-600' },
}

const timeAgo = (d) => {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60) return "à l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  const days = Math.floor(diff / 86400)
  return days === 1 ? 'hier' : `il y a ${days} j`
}

const NotificationBell = () => {
  const { token } = useAuth()
  const navigate = useNavigate()
  

  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  // ---------- Compteur (polling) ----------
   const fetchCount = useCallback(async () => {
    if (!token || document.hidden) return
    try {
      const data = await api.get('/notifications/unread_count/')
      setCount(data.count)
    } catch {
      /* serveur injoignable : on réessaiera au prochain passage */
    }
  }, [token])

  useEffect(() => {
    fetchCount()
    const id = setInterval(fetchCount, POLL_MS)
    const onVisible = () => !document.hidden && fetchCount()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchCount])

  // ---------- Fermeture au clic extérieur ----------
  useEffect(() => {
    if (!open) return
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // ---------- Liste ----------
    const loadItems = async () => {
    setLoading(true)
    try {
      setItems(await api.list('/notifications/'))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) loadItems()
  }

  const handleClick = (n) => {
    if (!n.is_read) {
        api.post(`/notifications/${n.id}/mark_read/`).catch(() => {})
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
      setCount((c) => Math.max(0, c - 1))
    }
    setOpen(false)
    if (n.link) navigate(n.link)
  }

    const markAll = async () => {
    try {
      await api.post('/notifications/mark_all_read/')
      setItems((prev) => prev.map((x) => ({ ...x, is_read: true })))
      setCount(0)
    } catch {
      /* ignoré : le badge se remettra à jour au prochain passage */
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className={`relative w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
          open ? 'bg-blue-50' : 'hover:bg-gray-100'
        }`}
        title="Notifications"
      >
                <IconBell className="w-5 h-5 text-gray-600" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">Notifications</p>
              <p className="text-xs text-gray-500">{count > 0 ? `${count} non lue(s)` : 'Tout est lu'}</p>
            </div>
            {count > 0 && (
              <button onClick={markAll} className="text-xs font-medium text-salesforce-blue hover:underline">
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">Chargement...</p>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <IconBellOff className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">Aucune notification</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {items.map((n) => {
                 const t = TYPES[n.type] || { icon: IconBell, bg: 'bg-gray-100', fg: 'text-gray-600' }
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => handleClick(n)}
                        className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 transition-colors ${
                          n.is_read ? '' : 'bg-blue-50/40'
                        }`}
                      >
                        <span className={`w-9 h-9 rounded-full ${t.bg} flex items-center justify-center flex-shrink-0`}>
                         <t.icon className={`w-4 h-4 ${t.fg}`} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={`block text-sm ${n.is_read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>
                            {n.title}
                          </span>
                          {n.message && (
                            <span
                              className="block text-xs text-gray-600 mt-0.5"
                              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                            >
                              {n.message}
                            </span>
                          )}
                          <span className="block text-[11px] text-gray-400 mt-1">{timeAgo(n.created_at)}</span>
                        </span>
                        {!n.is_read && <span className="w-2 h-2 mt-2 rounded-full bg-salesforce-blue flex-shrink-0" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell