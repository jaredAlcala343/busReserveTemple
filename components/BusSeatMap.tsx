'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  FaCheck, 
  FaTimes, 
  FaUser, 
  FaExclamationTriangle,
  FaBus,
  FaChair,
  FaDoorOpen,
  FaCar,
  FaMapMarkerAlt,
  FaInfoCircle
} from 'react-icons/fa'

interface Seat {
  id: number
  seat_number: string
  row_number: number
  position: string
  side: string
  status: 'available' | 'reserved' | 'paid' | 'maintenance'
}

interface ReservationData {
  passenger_name: string
  passenger_ward: string
}

interface BusSeatMapProps {
  onSeatSelect?: (seat: Seat) => void
  isAdmin?: boolean
  selectedSeat?: Seat | null
  reservationData?: ReservationData
  showDetails?: boolean
}

export default function BusSeatMap({ 
  onSeatSelect, 
  isAdmin = false, 
  selectedSeat, 
  reservationData,
  showDetails = false 
}: BusSeatMapProps) {
  const [seats, setSeats] = useState<Seat[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSeatId, setSelectedSeatId] = useState<number | null>(null)
  const [seatDetails, setSeatDetails] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSeats()
    
    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel('seat-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'bus_seats' }, 
        () => {
          loadSeats()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (selectedSeat) {
      setSelectedSeatId(selectedSeat.id)
      loadSeatDetails(selectedSeat.id)
    }
  }, [selectedSeat])

  const loadSeats = async () => {
    try {
      setError(null)
      const { data, error } = await supabase
        .from('bus_seats')
        .select('*')
        .order('row_number')
        .order('seat_number')

      if (error) throw error
      setSeats(data || [])
    } catch (error: any) {
      console.error('Error loading seats:', error)
      setError(`Error al cargar asientos: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const loadSeatDetails = async (seatId: number) => {
    if (!showDetails) return
    
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          bus_seats!inner(seat_number, row_number)
        `)
        .eq('seat_id', seatId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows returned
      
      setSeatDetails(data)
    } catch (error) {
      console.error('Error loading seat details:', error)
    }
  }

  const getSeatColor = (status: string) => {
    switch (status) {
      case 'available': 
        return 'bg-green-100 hover:bg-green-200 border-green-500 text-green-800'
      case 'reserved': 
        return 'bg-yellow-100 hover:bg-yellow-200 border-yellow-500 text-yellow-800'
      case 'paid': 
        return 'bg-red-100 hover:bg-red-200 border-red-500 text-red-800'
      case 'maintenance':
        return 'bg-gray-100 hover:bg-gray-200 border-gray-400 text-gray-600'
      default: 
        return 'bg-gray-100 border-gray-300 text-gray-600'
    }
  }

  const getSeatIcon = (status: string) => {
    switch (status) {
      case 'available': 
        return null
      case 'reserved': 
        return <FaUser className="w-3 h-3 absolute -top-1 -right-1 bg-yellow-500 text-white rounded-full p-0.5" />
      case 'paid': 
        return <FaCheck className="w-3 h-3 absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5" />
      case 'maintenance':
        return <FaTimes className="w-3 h-3 absolute -top-1 -right-1 bg-gray-500 text-white rounded-full p-0.5" />
      default: 
        return null
    }
  }

  const getPositionIcon = (position: string) => {
    switch (position) {
      case 'window': return '🪟'
      case 'aisle': return '🚶'
      case 'middle': return '🪑'
      default: return '❓'
    }
  }

  const getPositionText = (position: string) => {
    switch (position) {
      case 'window': return 'Ventana'
      case 'aisle': return 'Pasillo'
      case 'middle': return 'Centro'
      default: return position
    }
  }

  const getSideText = (side: string) => {
    switch (side) {
      case 'left': return 'Izquierda'
      case 'right': return 'Derecha'
      default: return side
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return 'Disponible'
      case 'reserved': return 'Reservado'
      case 'paid': return 'Pagado'
      case 'maintenance': return 'Mantenimiento'
      default: return status
    }
  }

  const handleSeatClick = (seat: Seat) => {
    if (!isAdmin && !['available', 'reserved'].includes(seat.status)) return
    
    setSelectedSeatId(seat.id)
    if (onSeatSelect) onSeatSelect(seat)
    
    if (showDetails) {
      loadSeatDetails(seat.id)
    }
  }

  const renderSeat = (seat: Seat) => {
    const isSelected = selectedSeatId === seat.id
    const isClickable = isAdmin || seat.status === 'available'
    
    return (
      <button
        key={seat.id}
        onClick={() => handleSeatClick(seat)}
        className={`
          relative w-12 h-12 rounded-lg border-2 flex flex-col items-center justify-center
          transition-all duration-200 ${getSeatColor(seat.status)}
          ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 scale-105' : ''}
          ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed opacity-75'}
          group
        `}
        disabled={!isClickable}
        title={`Asiento ${seat.seat_number} - ${getStatusText(seat.status)} - ${getPositionText(seat.position)} - ${getSideText(seat.side)}`}
      >
        {/* Número del asiento */}
        <span className="font-bold text-sm">{seat.seat_number.split('-')[1]}</span>
        
        {/* Icono de posición (pequeño) */}
        <span className="text-xs opacity-75">{getPositionIcon(seat.position)}</span>
        
        {/* Icono de estado */}
        {getSeatIcon(seat.status)}
        
        {/* Tooltip hover */}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 
                      bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 
                      transition-opacity duration-200 whitespace-nowrap z-10 pointer-events-none">
          <div className="font-semibold">Asiento {seat.seat_number}</div>
          <div>{getStatusText(seat.status)} • {getPositionText(seat.position)}</div>
        </div>
      </button>
    )
  }

  const renderSeatRow = (rowNumber: number) => {
    const rowSeats = seats.filter(seat => seat.row_number === rowNumber)
    const leftSeats = rowSeats.filter(seat => seat.side === 'left')
    const rightSeats = rowSeats.filter(seat => seat.side === 'right')
    
    return (
      <div key={rowNumber} className="flex items-center justify-center space-x-6 mb-4">
        {/* Número de fila */}
        <div className="w-10 text-center">
          <div className="font-bold text-gray-700">Fila</div>
          <div className="text-xl font-bold text-blue-600">{rowNumber}</div>
        </div>
        
        {/* Asientos izquierdos */}
        <div className="flex space-x-2">
          {leftSeats.map(seat => renderSeat(seat))}
        </div>
        
        {/* Pasillo */}
        <div className="w-12 bg-gray-300 h-1 mx-2 relative">
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-xs text-gray-500">
            Pasillo
          </div>
        </div>
        
        {/* Asientos derechos */}
        <div className="flex space-x-2">
          {rightSeats.map(seat => renderSeat(seat))}
        </div>
        
        {/* Información de fila (para admin) */}
        {isAdmin && (
          <div className="w-32 text-xs text-gray-600">
            <div className="grid grid-cols-2 gap-1">
              <div>Disponibles:</div>
              <div className="font-semibold">{rowSeats.filter(s => s.status === 'available').length}</div>
              <div>Reservados:</div>
              <div className="font-semibold text-yellow-600">{rowSeats.filter(s => s.status === 'reserved').length}</div>
              <div>Pagados:</div>
              <div className="font-semibold text-red-600">{rowSeats.filter(s => s.status === 'paid').length}</div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-96">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Cargando mapa de asientos...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <FaExclamationTriangle className="w-6 h-6 text-red-500 mr-2" />
          <h3 className="text-lg font-semibold text-red-800">Error al cargar los asientos</h3>
        </div>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={loadSeats}
          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center"
        >
          <FaExclamationTriangle className="w-4 h-4 mr-2" />
          Reintentar
        </button>
      </div>
    )
  }

  const rows = Array.from(new Set(seats.map(seat => seat.row_number))).sort((a, b) => a - b)
  const stats = {
    total: seats.length,
    available: seats.filter(s => s.status === 'available').length,
    reserved: seats.filter(s => s.status === 'reserved').length,
    paid: seats.filter(s => s.status === 'paid').length,
    maintenance: seats.filter(s => s.status === 'maintenance').length,
  }

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg">
      {/* Encabezado */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center justify-center">
          <FaBus className="w-6 h-6 mr-2 text-blue-600" />
          Mapa de Asientos del Autobús
        </h2>
        <p className="text-gray-600 mb-4">Capacidad: {stats.total} pasajeros • Disposición: 10 filas × 5 asientos</p>
        
        {/* Estadísticas rápidas */}
        <div className="flex flex-wrap justify-center gap-4 mb-4">
          <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center">
            <FaChair className="w-3 h-3 mr-1" />
            {stats.available} Disponibles
          </div>
          <div className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm flex items-center">
            <FaUser className="w-3 h-3 mr-1" />
            {stats.reserved} Reservados
          </div>
          <div className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm flex items-center">
            <FaCheck className="w-3 h-3 mr-1" />
            {stats.paid} Pagados
          </div>
          {stats.maintenance > 0 && (
            <div className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm flex items-center">
              <FaTimes className="w-3 h-3 mr-1" />
              {stats.maintenance} Mantenimiento
            </div>
          )}
        </div>
      </div>

      {/* Leyenda completa */}
      <div className="mb-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center">
          <FaInfoCircle className="w-4 h-4 mr-2 text-blue-600" />
          Leyenda
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-100 border-2 border-green-500 rounded-lg flex items-center justify-center mr-3 relative">
              <span className="font-bold">1</span>
            </div>
            <div>
              <div className="font-medium">Disponible</div>
              <div className="text-xs text-gray-500">Se puede reservar</div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-yellow-100 border-2 border-yellow-500 rounded-lg flex items-center justify-center mr-3 relative">
              <span className="font-bold">2</span>
              <FaUser className="w-3 h-3 absolute -top-1 -right-1 bg-yellow-500 text-white rounded-full p-0.5" />
            </div>
            <div>
              <div className="font-medium">Reservado</div>
              <div className="text-xs text-gray-500">Esperando pago/confirmación</div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-red-100 border-2 border-red-500 rounded-lg flex items-center justify-center mr-3 relative">
              <span className="font-bold">3</span>
              <FaCheck className="w-3 h-3 absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5" />
            </div>
            <div>
              <div className="font-medium">Pagado</div>
              <div className="text-xs text-gray-500">Reserva confirmada y pagada</div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gray-100 border-2 border-gray-400 rounded-lg flex items-center justify-center mr-3">
              <span className="font-bold">X</span>
            </div>
            <div>
              <div className="font-medium">Posiciones</div>
              <div className="text-xs text-gray-500">🪟 Ventana 🚶 Pasillo 🪑 Centro</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mapa del autobús */}
      <div className="relative mb-8">
        {/* Parte frontal del autobús */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-48 h-16 bg-gray-800 rounded-t-2xl flex items-center justify-center">
              <div className="w-32 h-8 bg-gray-900 rounded-t-lg flex items-center justify-center">
                <div className="flex space-x-4">
                  <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
                  <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
                </div>
              </div>
            </div>
            <div className="text-center mt-2 text-sm text-gray-600 font-semibold flex items-center justify-center">
              <FaCar className="w-4 h-4 mr-2" />
              FRONTAL • ASIENTO DEL CONDUCTOR
            </div>
          </div>
        </div>

        {/* Asientos */}
        <div className="border-4 border-gray-800 rounded-xl p-6 bg-gradient-to-b from-blue-50 to-white">
          {rows.map(row => renderSeatRow(row))}
          
          {/* Indicador de pasillo central */}
          <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-16 pointer-events-none">
            <div className="h-full border-l-4 border-r-4 border-dashed border-gray-400"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                          bg-white px-3 py-1 rounded-lg border border-gray-300 shadow-sm">
              <span className="text-xs font-semibold text-gray-600">PASILLO</span>
            </div>
          </div>
        </div>

        {/* Parte trasera del autobús */}
        <div className="flex justify-center mt-8">
          <div className="relative">
            <div className="w-64 h-12 bg-blue-700 rounded-lg flex items-center justify-center">
              <div className="text-white font-bold text-lg flex items-center">
                <FaDoorOpen className="w-5 h-5 mr-2" />
                SALIDA DE EMERGENCIA
              </div>
            </div>
            <div className="text-center mt-2 text-sm text-gray-600 font-semibold flex items-center justify-center">
              <FaDoorOpen className="w-4 h-4 mr-2" />
              TRASERA • SALIDA PRINCIPAL
            </div>
          </div>
        </div>

        {/* Indicadores laterales */}
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-10 
                      bg-blue-100 px-3 py-2 rounded-r-lg border border-blue-200">
          <div className="text-xs font-semibold text-blue-700 rotate-90 whitespace-nowrap">
            LADO IZQUIERDO
          </div>
        </div>
        <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-10 
                      bg-blue-100 px-3 py-2 rounded-l-lg border border-blue-200">
          <div className="text-xs font-semibold text-blue-700 -rotate-90 whitespace-nowrap">
            LADO DERECHO
          </div>
        </div>
      </div>

      {/* Información del asiento seleccionado */}
      {selectedSeat && (
        <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <div className={`w-6 h-6 rounded mr-3 ${getSeatColor(selectedSeat.status).split(' ')[0]} border-2`}></div>
            <FaMapMarkerAlt className="w-5 h-5 mr-2 text-blue-600" />
            Información del Asiento Seleccionado
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-sm text-gray-500">Número de Asiento</div>
              <div className="text-2xl font-bold text-blue-600">{selectedSeat.seat_number}</div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-sm text-gray-500">Fila y Posición</div>
              <div className="text-lg font-semibold">
                Fila {selectedSeat.row_number} • {getPositionText(selectedSeat.position)}
              </div>
              <div className="text-sm text-gray-600">Lado: {getSideText(selectedSeat.side)}</div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-sm text-gray-500">Estado Actual</div>
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                selectedSeat.status === 'available' ? 'bg-green-100 text-green-800' :
                selectedSeat.status === 'reserved' ? 'bg-yellow-100 text-yellow-800' :
                selectedSeat.status === 'paid' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {getStatusText(selectedSeat.status)}
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-sm text-gray-500">Características</div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{getPositionIcon(selectedSeat.position)}</span>
                <span className="font-medium">{getPositionText(selectedSeat.position)}</span>
              </div>
            </div>
          </div>

          {/* Información de reserva si existe */}
          {reservationData && (
            <div className="mt-6 p-4 bg-white rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2 flex items-center">
                <FaUser className="w-4 h-4 mr-2" />
                Información del Pasajero
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Nombre Completo</div>
                  <div className="font-medium">{reservationData.passenger_name}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Barrio/Unidad</div>
                  <div className="font-medium">{reservationData.passenger_ward}</div>
                </div>
              </div>
            </div>
          )}

          {/* Detalles adicionales para admin */}
          {isAdmin && seatDetails && (
            <div className="mt-6 p-4 bg-white rounded-lg border border-yellow-200">
              <h4 className="font-semibold text-yellow-800 mb-2 flex items-center">
                <FaInfoCircle className="w-4 h-4 mr-2" />
                Historial de Reserva
              </h4>
              <div className="text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-gray-500">Última reserva:</div>
                  <div>{seatDetails.created_at ? new Date(seatDetails.created_at).toLocaleString() : 'Nunca'}</div>
                  <div className="text-gray-500">Estado anterior:</div>
                  <div>{seatDetails.status || 'Sin historial'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Instrucciones según el estado */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <h4 className="font-semibold text-blue-800 mb-2 flex items-center">
              <FaInfoCircle className="w-4 h-4 mr-2" />
              Instrucciones
            </h4>
            {selectedSeat.status === 'available' ? (
              <p className="text-blue-700">
                Este asiento está disponible para reserva. Complete el formulario y haga clic en "Confirmar Reserva".
              </p>
            ) : selectedSeat.status === 'reserved' ? (
              <p className="text-yellow-700">
                Este asiento está reservado. Si es el administrador, puede confirmar el pago o cancelar la reserva.
              </p>
            ) : selectedSeat.status === 'paid' ? (
              <p className="text-red-700">
                Este asiento ha sido pagado y confirmado. No está disponible para nuevas reservas.
              </p>
            ) : (
              <p className="text-gray-700">
                Este asiento está en mantenimiento. No está disponible para reserva.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Información adicional */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="text-center text-sm text-gray-500">
          <p className="flex items-center justify-center">
            <FaChair className="w-4 h-4 mr-2" />
            <strong>Consejo:</strong> Los asientos cerca de las ventanas ofrecen mejor vista
          </p>
          <p className="mt-1 flex items-center justify-center">
            <FaDoorOpen className="w-4 h-4 mr-2" />
            Los asientos de pasillo permiten mayor movilidad
          </p>
          <p className="mt-1 flex items-center justify-center">
            <FaUser className="w-4 h-4 mr-2" />
            Para grupos, reserve asientos en la misma fila o filas contiguas
          </p>
        </div>
      </div>
    </div>
  )
}