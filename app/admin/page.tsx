'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import BusSeatMap from '@/components/BusSeatMap'
import NotificationSystem from '@/components/NotificationSystem'
import { useRouter } from 'next/navigation'
import { 
  FaBus, 
  FaUsers, 
  FaShieldAlt, 
  FaClock, 
  FaMapMarkerAlt,
  FaCheckCircle,
  FaArrowRight,
  FaEye,
  FaDownload,
  FaSync,  // Reemplazo de FaRefresh
  FaSignOutAlt,
  FaCalendar,
  FaTrashAlt,
  FaExclamationTriangle,
  FaSearch,
  FaTimes,  // Para el icono de rechazar
  FaUser,  // Para el icono de usuario
  FaCog
} from 'react-icons/fa';

interface Reservation {
  id: string
  passenger_name: string
  passenger_ward: string
  status: string
  seat_number: string
  payment_proof_url: string | null
  reservation_date: string
  seat_id: number
}

interface UserSession {
  id: string
  email: string
  role: string
  name: string
  ward?: string
}

interface Seat {
  id: number
  seat_number: string
  status: 'available' | 'reserved' | 'paid' | 'maintenance'
  row_number: number
  position: string
  side: string
}

interface BusConfig {
  id: string;
  bus_size: number;
  total_seats: number;
  is_active: boolean;
  created_at: string;
}

// Función para obtener sesión desde múltiples fuentes
const getSessionFromCookies = () => {
  try {
    const cookies = document.cookie.split(';')
    const sessionCookie = cookies.find(c => c.trim().startsWith('bus-reservation-session='))
    
    if (sessionCookie) {
      const cookieValue = sessionCookie.split('=')[1]
      return JSON.parse(decodeURIComponent(cookieValue))
    }
    
    // Fallback a localStorage
    const localSession = localStorage.getItem('bus-reservation-session')
    if (localSession) {
      const sessionData = JSON.parse(localSession)
      // Guardar también en cookies para el middleware
      document.cookie = `bus-reservation-session=${encodeURIComponent(localSession)}; path=/; max-age=86400; SameSite=Lax`
      return sessionData
    }
    
    return null
  } catch (error) {
    console.error('Error obteniendo sesión:', error)
    return null
  }
}

export default function AdminDashboard() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [userSession, setUserSession] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(true)
  const router = useRouter()

  // ========== ESTADOS PARA PRESIDENCIA ==========
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetOption, setResetOption] = useState<'all' | 'reservations' | 'seats'>('reservations')
  const [resetLoading, setResetLoading] = useState(false)
  const [seatActions, setSeatActions] = useState({
    selectedSeat: null as Seat | null,
    showSeatModal: false,
    newStatus: 'available' as string
  })

  // ========== NUEVOS ESTADOS PARA CONFIGURACIÓN DE AUTOBÚS ==========
  const [busConfig, setBusConfig] = useState<BusConfig | null>(null)
  const [showBusConfigModal, setShowBusConfigModal] = useState(false)
  const [selectedBusSize, setSelectedBusSize] = useState(40)
  const [busConfigLoading, setBusConfigLoading] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (userSession) {
      loadReservations()
      loadBusConfig()
      
      // Suscribirse a cambios en tiempo real
      const channel = supabase
        .channel('admin-reservations')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'reservations' }, 
          () => loadReservations()
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [userSession, filter, search])

  const checkAuth = () => {
    try {
      console.log('🔍 Verificando autenticación...')
      
      const sessionData = getSessionFromCookies()
      
      if (!sessionData) {
        console.log('❌ No hay sesión encontrada')
        router.push('/login')
        return
      }

      console.log('📋 Datos de sesión:', sessionData)

      // Verificar que tenga rol de administrador
      const allowedRoles = ['admin', 'bishop', 'quorum_president', 'stake_presidency']
      if (!allowedRoles.includes(sessionData.role)) {
        console.log(`🚫 Rol no autorizado: ${sessionData.role}`)
        alert(`Acceso denegado. Tu rol (${sessionData.role}) no tiene permisos para el panel de administración.`)
        router.push('/user')
        return
      }

      console.log('✅ Sesión válida, usuario autorizado')
      setUserSession(sessionData)
      
    } catch (error) {
      console.error('❌ Error en autenticación:', error)
      router.push('/login')
    } finally {
      setAuthLoading(false)
      setLoading(false)
    }
  }

  const loadReservations = async () => {
    try {
      console.log('📊 Cargando reservaciones...')
      
      // CONSULTA SIMPLIFICADA Y CORREGIDA
      let query = supabase
        .from('reservations')
        .select(`
          id,
          passenger_name,
          passenger_ward,
          status,
          seat_id,
          reservation_date,
          payment_proof_url,
          bus_seats!inner(seat_number)
        `)
        .order('reservation_date', { ascending: false })

      // Filtrar por barrio si es obispo o presidente de quórum
      if (userSession?.role === 'bishop' || userSession?.role === 'quorum_president') {
        query = query.eq('passenger_ward', userSession.ward)
        console.log(`🔍 Filtrando por barrio: ${userSession.ward}`)
      }

      // Filtrar por estado
      if (filter !== 'all') {
        query = query.eq('status', filter)
        console.log(`🔍 Filtrando por estado: ${filter}`)
      }

      // Buscar por nombre o barrio
      if (search) {
        query = query.or(`passenger_name.ilike.%${search}%,passenger_ward.ilike.%${search}%`)
        console.log(`🔍 Buscando: ${search}`)
      }

      const { data, error } = await query
      
      if (error) {
        console.error('❌ Error en consulta:', error)
        // Intentar consulta más simple si falla
        console.log('🔄 Intentando consulta alternativa...')
        await tryAlternativeQuery()
        return
      }

      console.log(`✅ ${data?.length || 0} reservaciones encontradas`)

      // Formatear los datos correctamente
      const formattedReservations = (data || []).map((item: any) => ({
        id: item.id,
        passenger_name: item.passenger_name,
        passenger_ward: item.passenger_ward,
        status: item.status,
        seat_number: item.bus_seats?.seat_number || 'N/A',
        seat_id: item.seat_id,
        payment_proof_url: item.payment_proof_url,
        reservation_date: item.reservation_date
      }))

      setReservations(formattedReservations)
    } catch (error: any) {
      console.error('❌ Error cargando reservaciones:', error.message || error)
      alert('Error al cargar reservaciones: ' + (error.message || 'Por favor, intente nuevamente'))
    }
  }

  // ========== FUNCIONES PARA CONFIGURACIÓN DE AUTOBÚS ==========
  const loadBusConfig = async () => {
    try {
      console.log('🚌 Cargando configuración del autobús...')
      
      const { data, error } = await supabase
        .from('bus_config')
        .select('*')
        .eq('is_active', true)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No hay configuración, crear una por defecto
          console.log('🔄 Creando configuración por defecto...')
          await createDefaultBusConfig()
          return
        }
        throw error
      }

      console.log('✅ Configuración del autobús cargada:', data)
      setBusConfig(data)
      setSelectedBusSize(data.bus_size)
    } catch (error) {
      console.error('❌ Error cargando configuración del autobús:', error)
    }
  }

  const createDefaultBusConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('bus_config')
        .insert([
          {
            bus_size: 40,
            total_seats: 40,
            is_active: true
          }
        ])
        .select()
        .single()

      if (error) throw error
      
      console.log('✅ Configuración por defecto creada:', data)
      setBusConfig(data)
      setSelectedBusSize(data.bus_size)
    } catch (error) {
      console.error('❌ Error creando configuración por defecto:', error)
    }
  }

  const updateBusSize = async () => {
    if (!busConfig) return
    
    setBusConfigLoading(true)
    
    try {
      console.log(`🔄 Actualizando tamaño del autobús a ${selectedBusSize} asientos...`)
      
      // 1. Desactivar la configuración actual
      await supabase
        .from('bus_config')
        .update({ is_active: false })
        .eq('id', busConfig.id)

      // 2. Crear nueva configuración
      const { data, error } = await supabase
        .from('bus_config')
        .insert([
          {
            bus_size: selectedBusSize,
            total_seats: selectedBusSize,
            is_active: true
          }
        ])
        .select()
        .single()

      if (error) throw error

      // 3. Crear/actualizar asientos según el nuevo tamaño
      await updateBusSeats(selectedBusSize)

      // 4. Actualizar estado local
      setBusConfig(data)
      setShowBusConfigModal(false)
      
      // 5. Recargar asientos
      await loadReservations()
      
      alert(`✅ Autobús configurado para ${selectedBusSize} asientos`)
      
    } catch (error) {
      console.error('❌ Error actualizando tamaño del autobús:', error)
      alert('❌ Error al actualizar el tamaño del autobús')
    } finally {
      setBusConfigLoading(false)
    }
  }

  const updateBusSeats = async (busSize: number) => {
    try {
      console.log(`🔄 Actualizando asientos para ${busSize} plazas...`)
      
      // Primero, obtener los asientos actuales
      const { data: existingSeats, error: seatsError } = await supabase
        .from('bus_seats')
        .select('id, seat_number, status')
        .order('id')

      if (seatsError) throw seatsError

      const existingCount = existingSeats?.length || 0

      if (busSize > existingCount) {
        // Agregar asientos faltantes
        const seatsToAdd = busSize - existingCount
        const newSeats = []

        console.log(`➕ Agregando ${seatsToAdd} asientos nuevos...`)

        for (let i = 1; i <= seatsToAdd; i++) {
          const seatNumber = existingCount + i
          const row = Math.ceil(seatNumber / 4)
          const positionInRow = (seatNumber - 1) % 4
          const position = positionInRow === 0 ? 'window' : 
                          positionInRow === 1 ? 'aisle' : 
                          positionInRow === 2 ? 'aisle' : 'window'
          const side = positionInRow < 2 ? 'left' : 'right'

          newSeats.push({
            seat_number: seatNumber.toString(),
            status: 'available',
            row_number: row,
            position: position,
            side: side
          })
        }

        if (newSeats.length > 0) {
          const { error: insertError } = await supabase
            .from('bus_seats')
            .insert(newSeats)

          if (insertError) throw insertError
        }
      } else if (busSize < existingCount) {
        // Eliminar asientos sobrantes (solo si no están reservados)
        const seatsToRemove = existingSeats?.slice(busSize) || []
        
        console.log(`➖ Eliminando ${seatsToRemove.length} asientos sobrantes...`)
        
        for (const seat of seatsToRemove) {
          // Verificar si el asiento está reservado
          const { data: reservation } = await supabase
            .from('reservations')
            .select('id')
            .eq('seat_id', seat.id)
            .in('status', ['reserved', 'confirmed', 'paid'])
            .single()

          if (!reservation && seat.status !== 'reserved') {
            // Solo eliminar si no tiene reservas activas
            await supabase
              .from('bus_seats')
              .delete()
              .eq('id', seat.id)
            console.log(`   Eliminado asiento ${seat.seat_number}`)
          } else {
            console.log(`   Conservando asiento ${seat.seat_number} (tiene reserva activa)`)
          }
        }
      } else {
        console.log('✅ El tamaño del autobús ya es correcto, no se requieren cambios')
      }

      console.log(`✅ Asientos actualizados para ${busSize} plazas`)
      return true
      
    } catch (error) {
      console.error('❌ Error actualizando asientos:', error)
      throw error
    }
  }

  const tryAlternativeQuery = async () => {
    try {
      console.log('🔄 Probando consulta alternativa...')
      
      // Consulta MUY simple para debug
      const { data: simpleData, error: simpleError } = await supabase
        .from('reservations')
        .select('*')
        .limit(5)

      if (simpleError) {
        console.error('❌ Error en consulta simple:', simpleError)
        alert(`Error de base de datos: ${simpleError.message}`)
        return
      }

      console.log('✅ Datos de prueba:', simpleData)
      
      // Si funciona, intentar con join
      const { data: joinData, error: joinError } = await supabase
        .from('reservations')
        .select(`
          *,
          bus_seats (
            seat_number
          )
        `)
        .limit(10)

      if (joinError) {
        console.error('❌ Error con join:', joinError)
        // Mostrar datos simples
        const formattedReservations = (simpleData || []).map((item: any) => ({
          id: item.id,
          passenger_name: item.passenger_name,
          passenger_ward: item.passenger_ward,
          status: item.status,
          seat_number: 'N/A', // No hay join
          seat_id: item.seat_id,
          payment_proof_url: item.payment_proof_url,
          reservation_date: item.reservation_date
        }))
        setReservations(formattedReservations)
        return
      }

      console.log('✅ Datos con join:', joinData)
      
      // Formatear datos con join exitoso
      const formattedReservations = (joinData || []).map((item: any) => ({
        id: item.id,
        passenger_name: item.passenger_name,
        passenger_ward: item.passenger_ward,
        status: item.status,
        seat_number: item.bus_seats?.seat_number || 'N/A',
        seat_id: item.seat_id,
        payment_proof_url: item.payment_proof_url,
        reservation_date: item.reservation_date
      }))

      setReservations(formattedReservations)
      
    } catch (altError: any) {
      console.error('❌ Error en consulta alternativa:', altError)
    }
  }

  const handleLogout = () => {
    // Limpiar todas las sesiones
    document.cookie = 'bus-reservation-session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
    localStorage.removeItem('bus-reservation-session')
    sessionStorage.removeItem('bus-session')
    
    console.log('👋 Sesión cerrada')
    router.push('/login')
  }

  const handleConfirmReservation = async (reservationId: string) => {
    if (!confirm('¿Confirmar esta reserva?')) return

    try {
      console.log(`✅ Confirmando reserva: ${reservationId}`)
      
      const { error } = await supabase
        .from('reservations')
        .update({ 
          status: 'confirmed',
          confirmed_by: userSession?.id,
          confirmation_date: new Date().toISOString()
        })
        .eq('id', reservationId)

      if (error) throw error

      // Actualizar estado del asiento
      const reservation = reservations.find(r => r.id === reservationId)
      if (reservation) {
        await supabase
          .from('bus_seats')
          .update({ status: 'paid' })
          .eq('id', reservation.seat_id)
      }

      await loadReservations()
      alert('✅ Reserva confirmada exitosamente')
    } catch (error) {
      console.error('❌ Error confirmando reserva:', error)
      alert('❌ Error al confirmar la reserva')
    }
  }

  const handleRejectReservation = async (reservationId: string) => {
    if (!confirm('¿Está seguro de rechazar esta reserva?')) return

    try {
      console.log(`❌ Rechazando reserva: ${reservationId}`)
      
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', reservationId)

      if (error) throw error

      // Liberar asiento
      const reservation = reservations.find(r => r.id === reservationId)
      if (reservation) {
        await supabase
          .from('bus_seats')
          .update({ status: 'available' })
          .eq('id', reservation.seat_id)
      }

      await loadReservations()
      alert('✅ Reserva rechazada exitosamente')
    } catch (error) {
      console.error('❌ Error rechazando reserva:', error)
      alert('❌ Error al rechazar la reserva')
    }
  }

  const handlePaymentUpload = async (reservationId: string, file: File) => {
    if (!file) return
    
    try {
      console.log(`📎 Subiendo comprobante para reserva: ${reservationId}`)
      
      // Crear nombre único para el archivo
      const fileExt = file.name.split('.').pop()
      const fileName = `${reservationId}-${Date.now()}.${fileExt}`
      
      // Intentar subir a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, file)

      if (uploadError) {
        console.log('⚠️ Error subiendo archivo, usando URL temporal:', uploadError)
        // Usar URL temporal para desarrollo
        const tempUrl = URL.createObjectURL(file)
        
        const { error: updateError } = await supabase
          .from('reservations')
          .update({ 
            payment_proof_url: tempUrl,
            status: 'paid',
            payment_date: new Date().toISOString()
          })
          .eq('id', reservationId)

        if (updateError) throw updateError
        
        await loadReservations()
        alert('✅ Comprobante registrado (modo desarrollo)')
        return
      }

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(fileName)

      // Actualizar reserva
      const { error: updateError } = await supabase
        .from('reservations')
        .update({ 
          payment_proof_url: urlData.publicUrl,
          status: 'paid',
          payment_date: new Date().toISOString()
        })
        .eq('id', reservationId)

      if (updateError) throw updateError

      await loadReservations()
      alert('✅ Comprobante de pago subido exitosamente')
    } catch (error) {
      console.error('❌ Error subiendo comprobante:', error)
      alert('❌ Error al subir el comprobante de pago')
    }
  }

  const exportToCSV = () => {
    const headers = ['Asiento', 'Nombre', 'Barrio', 'Estado', 'Fecha Reserva', 'Pagado']
    const csvData = reservations.map(r => [
      r.seat_number,
      r.passenger_name,
      r.passenger_ward,
      getStatusText(r.status),
      new Date(r.reservation_date).toLocaleDateString(),
      r.payment_proof_url ? 'Sí' : 'No'
    ])

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reservas-autobus-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    
    console.log('📊 Exportado a CSV')
  }

  // ========== NUEVAS FUNCIONALIDADES PARA PRESIDENCIA ==========

  // 1. Resetear viaje completo
  const handleResetTravel = async () => {
    if (!confirm(`¿Está seguro de resetear ${getResetText()}? Esta acción no se puede deshacer.`)) {
      return
    }

    setResetLoading(true)

    try {
      if (resetOption === 'reservations' || resetOption === 'all') {
        // Eliminar todas las reservas
        const { error: reservationsError } = await supabase
          .from('reservations')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000') // Eliminar todas

        if (reservationsError) throw reservationsError
        console.log('✅ Todas las reservas eliminadas')
      }

      if (resetOption === 'seats' || resetOption === 'all') {
        // Resetear todos los asientos a "available"
        const { error: seatsError } = await supabase
          .from('bus_seats')
          .update({ 
            status: 'available',
            updated_at: new Date().toISOString()
          })
          .neq('id', 0) // Actualizar todos

        if (seatsError) throw seatsError
        console.log('✅ Todos los asientos reseteados')
      }

      // Limpiar notificaciones relacionadas
      if (resetOption === 'all') {
        const { error: notificationsError } = await supabase
          .from('notifications')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000')

        if (notificationsError) {
          console.warn('⚠️ No se pudieron limpiar notificaciones:', notificationsError)
        }
      }

      // Recargar datos
      await loadReservations()
      
      // Notificar a usuarios
      await sendNotificationToAll({
        title: '📢 Viaje Reseteado',
        message: `El viaje ha sido reseteado por la Presidencia de Estaca. ${getResetText()}.`,
        type: 'system'
      })

      alert(`✅ ${getResetText()} correctamente.`)
      setShowResetModal(false)
      
    } catch (error) {
      console.error('❌ Error reseteando viaje:', error)
      alert('❌ Error al resetear el viaje. Por favor, intente nuevamente.')
    } finally {
      setResetLoading(false)
    }
  }

  const getResetText = () => {
    switch (resetOption) {
      case 'all': return 'Todo el sistema ha sido reseteado'
      case 'reservations': return 'Todas las reservas han sido eliminadas'
      case 'seats': return 'Todos los asientos han sido liberados'
      default: return 'El sistema ha sido reseteado'
    }
  }

  // 2. Enviar notificación a todos los usuarios
  const sendNotificationToAll = async (notification: any) => {
    try {
      // Obtener todos los usuarios
      const { data: users, error } = await supabase
        .from('system_users')
        .select('id')
        .neq('role', 'traveler') // Solo a líderes y admin

      if (error) throw error

      // Crear notificaciones
      const notifications = users?.map(user => ({
        user_id: user.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        is_read: false
      })) || []

      if (notifications.length > 0) {
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert(notifications)

        if (notificationError) throw notificationError
      }

      return true
    } catch (error) {
      console.error('Error enviando notificación:', error)
      return false
    }
  }

  // 3. Manejar acciones individuales en asientos (para presidencia)
  const handleSeatAction = (seat: Seat) => {
    setSeatActions({
      selectedSeat: seat,
      showSeatModal: true,
      newStatus: seat.status
    })
  }

  const updateSeatStatus = async () => {
    if (!seatActions.selectedSeat) return

    try {
      const { error } = await supabase
        .from('bus_seats')
        .update({ 
          status: seatActions.newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', seatActions.selectedSeat.id)

      if (error) throw error

      // Si el asiento estaba reservado, cancelar la reserva
      if (seatActions.selectedSeat.status === 'reserved' && seatActions.newStatus === 'available') {
        await supabase
          .from('reservations')
          .update({ status: 'cancelled' })
          .eq('seat_id', seatActions.selectedSeat.id)
          .eq('status', 'reserved')
      }

      // Recargar datos
      await loadReservations()
      
      alert(`✅ Asiento ${seatActions.selectedSeat.seat_number} actualizado a "${getStatusText(seatActions.newStatus)}"`)
      setSeatActions({
        selectedSeat: null,
        showSeatModal: false,
        newStatus: 'available'
      })

    } catch (error) {
      console.error('❌ Error actualizando asiento:', error)
      alert('❌ Error al actualizar el asiento')
    }
  }

  // 4. Exportar reporte completo
  const exportFullReport = async () => {
    try {
      // Obtener todos los datos
      const { data: fullData, error } = await supabase
        .from('reservations')
        .select(`
          *,
          bus_seats!inner(seat_number, row_number, position, side),
          confirmed_by_user:system_users!confirmed_by(name, role),
          passenger_user:system_users!user_id(name, email)
        `)
        .order('reservation_date', { ascending: false })

      if (error) throw error

      const headers = [
        'Asiento', 'Fila', 'Posición', 'Lado', 'Estado',
        'Nombre Pasajero', 'Barrio', 'Email', 'Teléfono',
        'Fecha Reserva', 'Fecha Pago', 'Confirmado Por', 'Rol Confirmador'
      ]

      const csvData = (fullData || []).map((item: any) => [
        item.bus_seats?.seat_number || 'N/A',
        item.bus_seats?.row_number || 'N/A',
        item.bus_seats?.position === 'window' ? 'Ventana' : 
          item.bus_seats?.position === 'aisle' ? 'Pasillo' : 'Centro',
        item.bus_seats?.side === 'left' ? 'Izquierda' : 'Derecha',
        getStatusText(item.status),
        item.passenger_name,
        item.passenger_ward,
        item.passenger_user?.email || 'N/A',
        item.phone || 'N/A',
        new Date(item.reservation_date).toLocaleString('es-ES'),
        item.payment_date ? new Date(item.payment_date).toLocaleString('es-ES') : 'No pagado',
        item.confirmed_by_user?.name || 'No confirmado',
        item.confirmed_by_user?.role ? getRoleText(item.confirmed_by_user.role) : 'N/A'
      ])

      const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-completo-viaje-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      console.log('📊 Reporte completo exportado')

    } catch (error) {
      console.error('❌ Error exportando reporte:', error)
      alert('❌ Error al exportar el reporte completo')
    }
  }

  // Funciones auxiliares de UI
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'reserved': return 'bg-yellow-100 text-yellow-800 border border-yellow-200'
      case 'confirmed': return 'bg-blue-100 text-blue-800 border border-blue-200'
      case 'paid': return 'bg-green-100 text-green-800 border border-green-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border border-red-200'
      case 'available': return 'bg-gray-100 text-gray-800 border border-gray-200'
      case 'maintenance': return 'bg-gray-800 text-white border border-gray-900'
      default: return 'bg-gray-100 text-gray-800 border border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'reserved': return 'Reservado'
      case 'confirmed': return 'Confirmado'
      case 'paid': return 'Pagado'
      case 'cancelled': return 'Cancelado'
      case 'available': return 'Disponible'
      case 'maintenance': return 'Mantenimiento'
      default: return status
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 border border-red-200'
      case 'bishop': return 'bg-blue-100 text-blue-800 border border-blue-200'
      case 'quorum_president': return 'bg-purple-100 text-purple-800 border border-purple-200'
      case 'stake_presidency': return 'bg-indigo-100 text-indigo-800 border border-indigo-200'
      default: return 'bg-gray-100 text-gray-800 border border-gray-200'
    }
  }

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador'
      case 'bishop': return 'Obispo'
      case 'quorum_president': return 'Presidente de Quórum'
      case 'stake_presidency': return 'Presidencia de Estaca'
      default: return role.replace('_', ' ')
    }
  }

  // Renderizado condicional para presidencia
  const isStakePresidency = userSession?.role === 'stake_presidency'

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Verificando autenticación...</p>
        <p className="text-sm text-gray-500 mt-2">Por favor espere</p>
      </div>
    )
  }

  if (!userSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <div className="text-center">
            <FaShieldAlt className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Acceso Requerido</h2>
            <p className="text-gray-600 mb-6">Debes iniciar sesión para acceder al panel de administración</p>
            <button
              onClick={() => router.push('/login')}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Ir al Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  const stats = {
    total: reservations.length,
    reserved: reservations.filter(r => r.status === 'reserved').length,
    confirmed: reservations.filter(r => r.status === 'confirmed').length,
    paid: reservations.filter(r => r.status === 'paid').length,
    cancelled: reservations.filter(r => r.status === 'cancelled').length,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className={`p-2 rounded-lg ${
                isStakePresidency ? 'bg-purple-100' : 'bg-blue-100'
              }`}>
                {isStakePresidency ? (
                  <FaUsers className="w-6 h-6 text-purple-600" />
                ) : (
                  <FaShieldAlt className="w-6 h-6 text-blue-600" />
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  {isStakePresidency ? 'Presidencia de Estaca' : 'Panel de Administración'}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(userSession?.role || '')}`}>
                    {getRoleText(userSession?.role || '')}
                  </span>
                  <span className="flex items-center text-sm text-gray-600">
                    <FaUsers className="w-3 h-3 mr-1" />
                    {userSession?.name}
                  </span>
                  {userSession?.ward && (
                    <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {userSession.ward}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Botón para configurar autobús - SOLO PRESIDENCIA */}
              {isStakePresidency && (
                <button
                  onClick={() => setShowBusConfigModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200"
                  title="Configurar tamaño del autobús"
                >
                  <FaCog className="w-4 h-4" />
                  <span className="hidden sm:inline">Configurar Autobús</span>
                  <span className="sm:hidden">Autobús</span>
                </button>
              )}
              
              {/* Botón de reset para presidencia */}
              {isStakePresidency && (
                <button
                  onClick={() => setShowResetModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                  title="Resetear viaje"
                >
                  <FaSync className="w-4 h-4" />
                  <span className="hidden sm:inline">Resetear Viaje</span>
                  <span className="sm:hidden">Reset</span>
                </button>
              )}
              
              {/* Botón de reporte completo */}
              {isStakePresidency && (
                <button
                  onClick={exportFullReport}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors border border-green-200"
                  title="Exportar reporte completo"
                >
                  <FaDownload className="w-4 h-4" />
                  <span className="hidden sm:inline">Reporte Completo</span>
                  <span className="sm:hidden">Reporte</span>
                </button>
              )}

              <button
                onClick={() => loadReservations()}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors border border-gray-200"
              >
                <FaSync className="w-4 h-4" />
                <span className="hidden sm:inline">Actualizar</span>
                <span className="sm:hidden">Refrescar</span>
              </button>

              <NotificationSystem 
                userId={userSession?.id || ''} 
                userRole={userSession?.role || ''} 
                ward={userSession?.ward} 
              />
              
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
              >
                <FaSignOutAlt className="w-4 h-4" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
                <span className="sm:hidden">Salir</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Panel de control rápido para presidencia */}
        {isStakePresidency && (
          <div className="mb-8 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl shadow-lg p-6 border border-purple-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <FaUsers className="w-5 h-5 mr-2 text-purple-600" />
                Panel de Control - Presidencia de Estaca
              </h2>
              {busConfig && (
                <div className="flex items-center bg-white px-4 py-2 rounded-lg border border-purple-200 shadow-sm">
                  <FaBus className="w-5 h-5 text-purple-600 mr-2" />
                  <div>
                    <div className="font-semibold text-purple-700 text-sm">Tamaño del Autobús</div>
                    <div className="text-xl font-bold text-purple-800">{busConfig.bus_size} asientos</div>
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setShowBusConfigModal(true)}
                className="p-4 bg-white rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors text-left group"
              >
                <div className="flex items-center mb-2">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-indigo-200 transition-colors">
                    <FaCog className="w-5 h-5 text-indigo-600" />
                  </div>
                  <span className="font-semibold text-gray-800">Configurar Autobús</span>
                </div>
                <p className="text-sm text-gray-600 ml-13">Cambiar tamaño (30-65 asientos)</p>
              </button>
              
              <button
                onClick={() => setShowResetModal(true)}
                className="p-4 bg-white rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-left group"
              >
                <div className="flex items-center mb-2">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-red-200 transition-colors">
                    <FaSync className="w-5 h-5 text-red-600" />
                  </div>
                  <span className="font-semibold text-gray-800">Resetear Viaje</span>
                </div>
                <p className="text-sm text-gray-600 ml-13">Eliminar reservas y liberar asientos</p>
              </button>
              
              <button
                onClick={exportFullReport}
                className="p-4 bg-white rounded-lg border border-green-200 hover:bg-green-50 transition-colors text-left group"
              >
                <div className="flex items-center mb-2">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-green-200 transition-colors">
                    <FaDownload className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="font-semibold text-gray-800">Reporte Completo</span>
                </div>
                <p className="text-sm text-gray-600 ml-13">Exportar todos los datos del viaje</p>
              </button>
            </div>
          </div>
        )}

        {/* Estadísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow p-4">
            <div className="text-sm text-gray-500 mb-1">Total Reservas</div>
            <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <div className="text-sm text-gray-500 mb-1">Reservados</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.reserved}</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <div className="text-sm text-gray-500 mb-1">Confirmados</div>
            <div className="text-2xl font-bold text-blue-600">{stats.confirmed}</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <div className="text-sm text-gray-500 mb-1">Pagados</div>
            <div className="text-2xl font-bold text-green-600">{stats.paid}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Panel izquierdo - Mapa de asientos */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                  <div className="w-2 h-6 bg-blue-600 rounded mr-2"></div>
                  Mapa de Asientos del Autobús
                </h2>
                {isStakePresidency && (
                  <div className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-lg">
                    💡 Haz clic en cualquier asiento para gestionarlo
                  </div>
                )}
              </div>
              <div className="border rounded-lg overflow-hidden">
                <BusSeatMap 
                  isAdmin={true} 
                  userRole={userSession?.role}
                  busSize={busConfig?.bus_size || 40}
                  onSeatSelect={isStakePresidency ? handleSeatAction : undefined}
                />
              </div>
              
              {isStakePresidency && (
                <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h3 className="font-semibold text-purple-800 mb-2 flex items-center">
                    <FaExclamationTriangle className="w-4 h-4 mr-2" />
                    Funciones de Presidencia
                  </h3>
                  <ul className="text-sm text-purple-700 space-y-1">
                    <li>• Haz clic en cualquier asiento para cambiar su estado</li>
                    <li>• Puedes liberar asientos reservados si es necesario</li>
                    <li>• Usa "Configurar Autobús" para cambiar el tamaño (30-65 asientos)</li>
                    <li>• Usa "Resetear Viaje" para comenzar un nuevo viaje</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Panel derecho - Lista de reservas */}
          <div>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                  <div className="w-2 h-6 bg-green-600 rounded mr-2"></div>
                  Gestión de Reservas
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={exportToCSV}
                    className="flex items-center space-x-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                    title="Exportar a CSV"
                  >
                    <FaDownload className="w-4 h-4" />
                    <span className="hidden sm:inline">Exportar</span>
                    <span className="sm:hidden">CSV</span>
                  </button>
                </div>
              </div>

              {/* Filtros y búsqueda */}
              <div className="space-y-4 mb-6">
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o barrio..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {['all', 'reserved', 'confirmed', 'paid', 'cancelled'].map(status => (
                    <button
                      key={status}
                      onClick={() => setFilter(status)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        filter === status
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {status === 'all' ? 'Todos' : getStatusText(status)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lista de reservas */}
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                    <p className="text-gray-500">Cargando reservas...</p>
                  </div>
                ) : reservations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    <div className="text-4xl mb-3">📭</div>
                    <p>No hay reservas para mostrar</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {search || filter !== 'all' ? 'Intenta con otros filtros' : 'Todavía no hay reservas'}
                    </p>
                    <button
                      onClick={() => loadReservations()}
                      className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm"
                    >
                      Recargar
                    </button>
                  </div>
                ) : (
                  reservations.map(reservation => (
                    <div
                      key={reservation.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800 truncate">
                            {reservation.passenger_name}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">{reservation.passenger_ward}</p>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(reservation.status)}`}>
                            {getStatusText(reservation.status)}
                          </span>
                          <span className="font-mono text-sm bg-gray-50 px-2 py-1 rounded border">
                            {reservation.seat_number}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center text-xs text-gray-500 mb-4">
                        <FaCalendar className="w-3 h-3 mr-1" />
                        {new Date(reservation.reservation_date).toLocaleString('es-ES')}
                      </div>

                      <div className="flex space-x-2">
                        {reservation.status === 'reserved' && (
                          <>
                            <button
                              onClick={() => handleConfirmReservation(reservation.id)}
                              className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors border border-green-200"
                            >
                              <FaCheckCircle className="w-4 h-4" />
                              <span>Confirmar</span>
                            </button>
                            <button
                              onClick={() => handleRejectReservation(reservation.id)}
                              className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                            >
                              <FaTimes className="w-4 h-4" />
                              <span>Rechazar</span>
                            </button>
                          </>
                        )}

                        {reservation.status === 'confirmed' && !reservation.payment_proof_url && (
                          <div className="w-full">
                            <label className="block w-full cursor-pointer">
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) {
                                    handlePaymentUpload(reservation.id, file)
                                  }
                                }}
                              />
                              <div className="w-full px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-center transition-colors border border-blue-200">
                                📎 Subir Pago
                              </div>
                            </label>
                          </div>
                        )}

                        {reservation.payment_proof_url && (
                          <button
                            onClick={() => window.open(reservation.payment_proof_url!, '_blank')}
                            className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors border border-purple-200"
                          >
                            <FaEye className="w-4 h-4" />
                            <span>Ver Pago</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Reset para Presidencia */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-3">
                  <FaExclamationTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Resetear Viaje</h3>
                  <p className="text-sm text-gray-600">Esta acción no se puede deshacer</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selecciona qué quieres resetear:
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 'reservations', label: 'Solo Reservas', desc: 'Eliminará todas las reservas pero mantendrá los asientos' },
                      { value: 'seats', label: 'Solo Asientos', desc: 'Liberará todos los asientos pero mantendrá el historial' },
                      { value: 'all', label: 'Todo el Sistema', desc: 'Eliminará reservas y liberará asientos completamente' }
                    ].map(option => (
                      <label key={option.value} className="flex items-start p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="radio"
                          name="resetOption"
                          value={option.value}
                          checked={resetOption === option.value}
                          onChange={(e) => setResetOption(e.target.value as any)}
                          className="mt-1 mr-3"
                        />
                        <div>
                          <div className="font-medium text-gray-800">{option.label}</div>
                          <div className="text-xs text-gray-500">{option.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <FaExclamationTriangle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <strong>Advertencia:</strong> Esta acción eliminará permanentemente {
                        resetOption === 'reservations' ? 'todas las reservas' :
                        resetOption === 'seats' ? 'el estado de todos los asientos' :
                        'todos los datos del viaje'
                      }.
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowResetModal(false)}
                    className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    disabled={resetLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleResetTravel}
                    disabled={resetLoading}
                    className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center"
                  >
                    {resetLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Procesando...
                      </>
                    ) : (
                      <>
                        <FaSync className="w-4 h-4 mr-2" />
                        {resetOption === 'all' ? 'Resetear Todo' : 'Confirmar'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para configurar tamaño del autobús */}
      {showBusConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                  <FaBus className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Configurar Autobús</h3>
                  <p className="text-sm text-gray-600">Selecciona el tamaño del autobús (30-65 asientos)</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Tamaño actual: 
                      <span className="ml-2 font-bold text-lg text-indigo-600">
                        {busConfig?.bus_size || 40} asientos
                      </span>
                    </label>
                    <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {selectedBusSize} asientos seleccionados
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-500">Tamaño pequeño</span>
                      <span className="text-sm text-gray-500">Tamaño grande</span>
                    </div>
                    
                    <input
                      type="range"
                      min="30"
                      max="65"
                      step="1"
                      value={selectedBusSize}
                      onChange={(e) => setSelectedBusSize(parseInt(e.target.value))}
                      className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-lg"
                    />
                    
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      <span>30</span>
                      <span>40</span>
                      <span>50</span>
                      <span>60</span>
                      <span>65</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
                    {[30, 35, 40, 45, 50, 55, 60, 65].map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedBusSize(size)}
                        className={`py-3 px-4 rounded-lg border transition-all duration-200 ${
                          selectedBusSize === size
                            ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow-sm transform scale-105'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-semibold">{size}</div>
                        <div className="text-xs text-gray-500 mt-1">asientos</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <FaExclamationTriangle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <strong>Nota:</strong> Al cambiar el tamaño:
                      <ul className="mt-1 ml-4 list-disc space-y-1">
                        <li>Si reduces el tamaño, se eliminarán los asientos vacíos</li>
                        <li>Los asientos con reservas activas no se eliminarán</li>
                        <li>Se reiniciará el mapa de asientos automáticamente</li>
                        <li>Recomendado: Resetear el viaje antes de cambiar tamaño</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3 pt-2">
                  <button
                    onClick={() => setShowBusConfigModal(false)}
                    className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    disabled={busConfigLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={updateBusSize}
                    disabled={busConfigLoading}
                    className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center justify-center"
                  >
                    {busConfigLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Configurando...
                      </>
                    ) : (
                      <>
                        <FaCheckCircle className="w-5 h-5 mr-2" />
                        Aplicar Cambios
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para gestionar asiento (Presidencia) */}
      {seatActions.showSeatModal && seatActions.selectedSeat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Gestionar Asiento {seatActions.selectedSeat.seat_number}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado actual: 
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs ${getStatusBadgeColor(seatActions.selectedSeat.status)}`}>
                      {getStatusText(seatActions.selectedSeat.status)}
                    </span>
                  </label>
                  
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cambiar estado a:
                  </label>
                  <select
                    value={seatActions.newStatus}
                    onChange={(e) => setSeatActions({...seatActions, newStatus: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="available">🟢 Disponible</option>
                    <option value="reserved">🟡 Reservado</option>
                    <option value="paid">🔴 Pagado</option>
                    <option value="maintenance">⚫ Mantenimiento</option>
                  </select>
                </div>

                {seatActions.selectedSeat.status === 'reserved' && seatActions.newStatus === 'available' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-start">
                      <FaExclamationTriangle className="w-4 h-4 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-red-700">
                        Al liberar este asiento, se cancelará la reserva asociada.
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setSeatActions({
                      selectedSeat: null,
                      showSeatModal: false,
                      newStatus: 'available'
                    })}
                    className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={updateSeatStatus}
                    className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Actualizar Estado
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}