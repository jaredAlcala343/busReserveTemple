'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import BusSeatMap from '@/components/BusSeatMap'
import NotificationSystem from '@/components/NotificationSystem'
import { useRouter } from 'next/navigation'
import { Search, Filter, Download, CheckCircle, XCircle, Eye, LogOut, User, Shield, Calendar } from 'lucide-react'

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

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (userSession) {
      loadReservations()
      
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

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'reserved': return 'bg-yellow-100 text-yellow-800 border border-yellow-200'
      case 'confirmed': return 'bg-blue-100 text-blue-800 border border-blue-200'
      case 'paid': return 'bg-green-100 text-green-800 border border-green-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border border-red-200'
      default: return 'bg-gray-100 text-gray-800 border border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'reserved': return 'Reservado'
      case 'confirmed': return 'Confirmado'
      case 'paid': return 'Pagado'
      case 'cancelled': return 'Cancelado'
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
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
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
              <div className="bg-blue-100 p-2 rounded-lg">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Panel de Administración</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(userSession.role)}`}>
                    {getRoleText(userSession.role)}
                  </span>
                  <span className="flex items-center text-sm text-gray-600">
                    <User className="w-3 h-3 mr-1" />
                    {userSession.name}
                  </span>
                  {userSession.ward && (
                    <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {userSession.ward}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => loadReservations()}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors border border-gray-200 text-sm"
                title="Recargar reservas"
              >
                🔄 Actualizar
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Estadísticas rápidas */}
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
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <div className="w-2 h-6 bg-blue-600 rounded mr-2"></div>
                Mapa de Asientos del Autobús
              </h2>
              <div className="border rounded-lg overflow-hidden">
                <BusSeatMap isAdmin={true} />
              </div>
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
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Exportar</span>
                  </button>
                </div>
              </div>

              {/* Filtros y búsqueda */}
              <div className="space-y-4 mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(reservation.reservation_date).toLocaleString('es-ES')}
                      </div>

                      <div className="flex space-x-2">
                        {reservation.status === 'reserved' && (
                          <>
                            <button
                              onClick={() => handleConfirmReservation(reservation.id)}
                              className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors border border-green-200"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>Confirmar</span>
                            </button>
                            <button
                              onClick={() => handleRejectReservation(reservation.id)}
                              className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                            >
                              <XCircle className="w-4 h-4" />
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
                            <Eye className="w-4 h-4" />
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
    </div>
  )
}