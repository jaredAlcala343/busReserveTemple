'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  FaBell, 
  FaCheckCircle, 
  FaExclamationTriangle, 
  FaDollarSign, 
  FaUserPlus,
  FaEnvelope,
  FaCalendarAlt,
  FaTimes,
  FaCheck,
  FaInfoCircle
} from 'react-icons/fa'

interface Notification {
  id: string
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
  related_reservation_id?: string
}

interface NotificationSystemProps {
  userId: string
  userRole: string
  ward?: string
}

export default function NotificationSystem({ userId, userRole, ward }: NotificationSystemProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    loadNotifications()
    
    // Suscribirse a nuevas notificaciones
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'notifications' }, 
        (payload) => {
          const newNotification = payload.new as Notification
          // Filtrar por rol y barrio si es necesario
          if (shouldShowNotification(newNotification)) {
            setNotifications(prev => [newNotification, ...prev])
            setUnreadCount(prev => prev + 1)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, userRole, ward])

  const shouldShowNotification = (notification: Notification) => {
    if (userRole === 'admin' || userRole === 'stake_presidency') return true
    
    // Para obispos y presidentes de quórum, mostrar solo notificaciones de su barrio
    const message = notification.message.toLowerCase()
    if (ward && message.includes(ward.toLowerCase())) {
      return true
    }
    
    return false
  }

  const loadNotifications = async () => {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      const { data, error } = await query
      if (error) throw error
      
      const filteredNotifications = data?.filter(shouldShowNotification) || []
      setNotifications(filteredNotifications)
      setUnreadCount(filteredNotifications.filter(n => !n.is_read).length)
    } catch (error) {
      console.error('Error loading notifications:', error)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)

      if (error) throw error
      
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
      if (unreadIds.length === 0) return

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds)

      if (error) throw error
      
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const deleteNotification = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevenir que se marque como leída
    
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)

      if (error) throw error
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      setUnreadCount(prev => {
        const notification = notifications.find(n => n.id === notificationId)
        return notification && !notification.is_read ? prev - 1 : prev
      })
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'reservation': return <FaUserPlus className="w-5 h-5 text-blue-500" />
      case 'payment': return <FaDollarSign className="w-5 h-5 text-green-500" />
      case 'confirmation': return <FaCheckCircle className="w-5 h-5 text-purple-500" />
      case 'reminder': return <FaCalendarAlt className="w-5 h-5 text-orange-500" />
      case 'system': return <FaInfoCircle className="w-5 h-5 text-gray-500" />
      default: return <FaExclamationTriangle className="w-5 h-5 text-yellow-500" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'reservation': return 'border-l-4 border-l-blue-500'
      case 'payment': return 'border-l-4 border-l-green-500'
      case 'confirmation': return 'border-l-4 border-l-purple-500'
      case 'reminder': return 'border-l-4 border-l-orange-500'
      case 'system': return 'border-l-4 border-l-gray-500'
      default: return 'border-l-4 border-l-yellow-500'
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Notificaciones"
      >
        <FaBell className="w-6 h-6 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <>
          {/* Overlay para cerrar al hacer clic fuera */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowNotifications(false)}
          />
          
          {/* Panel de notificaciones */}
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border z-50">
            <div className="p-4 border-b flex justify-between items-center">
              <div className="flex items-center">
                <FaBell className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="font-semibold text-gray-800">Notificaciones</h3>
                {unreadCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">
                    {unreadCount} sin leer
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <FaCheck className="w-3 h-3 mr-1" />
                    Marcar todas como leídas
                  </button>
                )}
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaTimes className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <FaEnvelope className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No hay notificaciones</p>
                  <p className="text-sm text-gray-400 mt-1">Todo está al día</p>
                </div>
              ) : (
                notifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`p-4 border-b hover:bg-gray-50 cursor-pointer transition-colors ${getNotificationColor(notification.type)} ${
                      !notification.is_read ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium text-gray-900 truncate">
                            {notification.title}
                          </h4>
                          <button
                            onClick={(e) => deleteNotification(notification.id, e)}
                            className="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0"
                            aria-label="Eliminar notificación"
                          >
                            <FaTimes className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <div className="flex justify-between items-center mt-2">
                          <p className="text-xs text-gray-400">
                            {new Date(notification.created_at).toLocaleString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: 'numeric',
                              month: 'short'
                            })}
                          </p>
                          {!notification.is_read && (
                            <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-3 border-t bg-gray-50">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">
                    {notifications.length} notificaciones
                  </span>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Cerrar panel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}