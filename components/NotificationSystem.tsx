'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Bell, CheckCircle, AlertCircle, DollarSign, UserPlus } from 'lucide-react'

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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'reservation': return <UserPlus className="w-5 h-5 text-blue-500" />
      case 'payment': return <DollarSign className="w-5 h-5 text-green-500" />
      case 'confirmation': return <CheckCircle className="w-5 h-5 text-purple-500" />
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 rounded-full hover:bg-gray-100"
      >
        <Bell className="w-6 h-6 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border z-50">
          <div className="p-4 border-b">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Notificaciones</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No hay notificaciones
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 border-b hover:bg-gray-50 cursor-pointer ${
                    !notification.is_read ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start space-x-3">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {notification.title}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}