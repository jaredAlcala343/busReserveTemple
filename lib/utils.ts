import { supabase } from './supabase'

interface NotificationData {
  title: string
  message: string
  type: string
  ward?: string
  related_reservation_id?: string
}

export async function sendNotification(data: NotificationData) {
  try {
    // Obtener usuarios a notificar
    let userQuery = supabase
      .from('system_users')
      .select('id')
      .in('role', ['bishop', 'quorum_president', 'admin', 'stake_presidency'])

    if (data.ward) {
      userQuery = userQuery.eq('ward', data.ward)
    }

    const { data: users, error: userError } = await userQuery
    if (userError) throw userError

    // Crear notificaciones para cada usuario
    const notifications = users?.map(user => ({
      user_id: user.id,
      title: data.title,
      message: data.message,
      type: data.type,
      related_reservation_id: data.related_reservation_id
    })) || []

    if (notifications.length > 0) {
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert(notifications)

      if (notificationError) throw notificationError
    }

    return true
  } catch (error) {
    console.error('Error sending notification:', error)
    return false
  }
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function validateEmail(email: string) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

export function validatePhone(phone: string) {
  const re = /^[\+]?[1-9][\d]{0,15}$/
  return re.test(phone.replace(/\D/g, ''))
}