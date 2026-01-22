'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import BusSeatMap from '@/components/BusSeatMap'
import { 
  FaBus, 
  FaUser, 
  FaMapMarkerAlt, 
  FaPhone, 
  FaEnvelope, 
  FaCalendarAlt,
  FaCheckCircle
} from 'react-icons/fa'

interface Seat {
  id: number
  seat_number: string
  row_number: number
  position: string
  side: string
  status: 'available' | 'reserved' | 'paid' | 'maintenance'
}

// Componente del cliente - NO exportar dynamic/revalidate aquí

export default function UserReservationPage() {
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null)
  const [formData, setFormData] = useState({
    passenger_name: '',
    passenger_ward: '',
    email: '',
    phone: ''
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [availableSeats, setAvailableSeats] = useState(0)
  const [totalSeats, setTotalSeats] = useState(50)
  const [pageLoaded, setPageLoaded] = useState(false)

  useEffect(() => {
    // Marcar que la página se cargó en el cliente
    setPageLoaded(true)
    loadAvailableSeats()
  }, [])

  const loadAvailableSeats = async () => {
    if (!supabase) {
      console.warn('Supabase no está configurado')
      return
    }

    try {
      const { data, error } = await supabase
        .from('bus_seats')
        .select('status')
      
      if (!error && data) {
        const available = data.filter(seat => seat.status === 'available').length
        setAvailableSeats(available)
      }
    } catch (error) {
      console.error('Error loading seats:', error)
    }
  }

  const handleSeatSelect = (seat: Seat) => {
    setSelectedSeat(seat)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSeat) return

    setLoading(true)

    try {
      // 1. Crear reserva
      const { data: reservation, error: reservationError } = await supabase
        .from('reservations')
        .insert({
          seat_id: selectedSeat.id,
          passenger_name: formData.passenger_name,
          passenger_ward: formData.passenger_ward,
          status: 'reserved',
          reservation_date: new Date().toISOString()
        })
        .select()
        .single()

      if (reservationError) throw reservationError

      // 2. Actualizar estado del asiento
      const { error: seatError } = await supabase
        .from('bus_seats')
        .update({ status: 'reserved' })
        .eq('id', selectedSeat.id)

      if (seatError) throw seatError

      // 3. Enviar notificación (simplificada)
      console.log(`📧 Notificación: ${formData.passenger_name} reservó asiento ${selectedSeat.seat_number}`)

      setSuccess(true)
      setSelectedSeat(null)
      setFormData({
        passenger_name: '',
        passenger_ward: '',
        email: '',
        phone: ''
      })

      // Actualizar contador
      loadAvailableSeats()

      // Resetear mensaje después de 5 segundos
      setTimeout(() => setSuccess(false), 5000)

    } catch (error) {
      console.error('Error creating reservation:', error)
      alert('Error al crear la reserva. Por favor, intente nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const wards = [
    'Barrio 1', 'Barrio 2', 'Barrio 3', 'Barrio 4', 'Barrio 5',
    'Barrio 6', 'Barrio 7', 'Barrio 8', 'Barrio 9', 'Barrio 10'
  ]

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const nextSunday = new Date()
  nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()) % 7)

  // Si la página no se ha cargado en el cliente, mostrar skeleton
  if (!pageLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="h-96 bg-gray-200 rounded"></div>
              <div className="h-96 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-6 md:mb-0">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-white/20 p-3 rounded-full">
                  <FaBus className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Reserva de Asientos</h1>
                  <p className="text-blue-100">Viaje Especial - {formatDate(nextSunday)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{availableSeats}</div>
                <div className="text-sm text-blue-200">Asientos Disponibles</div>
                <div className="text-xs text-blue-300 mt-1">de {totalSeats} totales</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Panel izquierdo - Mapa de asientos */}
          <div>
            <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
              <div className="p-4 bg-gray-50 border-b">
                <h2 className="text-xl font-bold text-gray-800">Selecciona tu Asiento</h2>
                <p className="text-gray-600 text-sm">Haz clic en un asiento disponible (verde) para reservarlo</p>
              </div>
              <div className="p-4">
                <BusSeatMap
                  onSeatSelect={handleSeatSelect}
                  selectedSeat={selectedSeat}
                  reservationData={formData}
                />
              </div>
            </div>

            {/* Información del viaje */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <FaCalendarAlt className="w-5 h-5 mr-2 text-blue-600" />
                Información del Viaje
              </h3>
              <div className="space-y-3">
                <div className="flex items-center text-gray-700">
                  <div className="w-24 font-medium">Fecha:</div>
                  <div>{formatDate(nextSunday)}</div>
                </div>
                <div className="flex items-center text-gray-700">
                  <div className="w-24 font-medium">Hora:</div>
                  <div>08:00 AM - Salida puntual</div>
                </div>
                <div className="flex items-center text-gray-700">
                  <div className="w-24 font-medium">Capacidad:</div>
                  <div>{totalSeats} pasajeros máximo</div>
                </div>
                <div className="flex items-center text-gray-700">
                  <div className="w-24 font-medium">Disponibles:</div>
                  <div className="font-bold text-green-600">{availableSeats} asientos</div>
                </div>
              </div>
            </div>
          </div>

          {/* Panel derecho - Formulario de reserva */}
          <div>
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {selectedSeat ? `Reservar Asiento ${selectedSeat.seat_number}` : 'Completa tus Datos'}
              </h2>
              <p className="text-gray-600 mb-6">Todos los campos marcados con * son obligatorios</p>

              {success && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                      <FaCheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-green-800">¡Reserva Exitosa!</h3>
                      <p className="text-green-600 text-sm">
                        Tu asiento ha sido reservado. Recibirás una confirmación por correo.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FaUser className="w-4 h-4 inline mr-1" />
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    name="passenger_name"
                    value={formData.passenger_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ingresa tu nombre completo"
                    required
                    disabled={!selectedSeat || loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FaMapMarkerAlt className="w-4 h-4 inline mr-1" />
                    Barrio / Unidad *
                  </label>
                  <select
                    name="passenger_ward"
                    value={formData.passenger_ward}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={!selectedSeat || loading}
                  >
                    <option value="">Selecciona tu barrio</option>
                    {wards.map(ward => (
                      <option key={ward} value={ward}>{ward}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FaEnvelope className="w-4 h-4 inline mr-1" />
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="ejemplo@email.com"
                    disabled={!selectedSeat || loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FaPhone className="w-4 h-4 inline mr-1" />
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+52 123 456 7890"
                    disabled={!selectedSeat || loading}
                  />
                </div>

                {selectedSeat && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h3 className="font-semibold text-blue-800 mb-3">Resumen de tu Reserva</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-sm text-gray-600">Asiento:</div>
                        <div className="font-bold text-lg text-blue-700">{selectedSeat.seat_number}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-gray-600">Estado:</div>
                        <div className="font-medium">
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                            Disponible
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-gray-600">Fila:</div>
                        <div className="font-medium">{selectedSeat.row_number}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-gray-600">Posición:</div>
                        <div className="font-medium">
                          {selectedSeat.position === 'window' ? 'Ventana' : 
                           selectedSeat.position === 'aisle' ? 'Pasillo' : 'Centro'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!selectedSeat || loading || !formData.passenger_name || !formData.passenger_ward}
                  className={`w-full py-4 px-6 rounded-xl font-bold text-white transition-all duration-200 ${
                    !selectedSeat || loading || !formData.passenger_name || !formData.passenger_ward
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Procesando tu reserva...
                    </div>
                  ) : (
                    'Confirmar Reserva'
                  )}
                </button>

                <div className="text-xs text-gray-500 pt-4 border-t border-gray-200">
                  <p><strong>Nota:</strong> Al reservar, se notificará automáticamente a los líderes de tu barrio.</p>
                  <p className="mt-2">La confirmación final y pago se coordinará con los líderes correspondientes.</p>
                </div>
              </form>
            </div>

            {/* Información adicional */}
            <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow p-6">
              <h3 className="font-bold text-gray-800 mb-3">¿Necesitas ayuda?</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mr-2 mt-0.5">
                    <span className="text-blue-600 text-xs">1</span>
                  </div>
                  <span>Selecciona un asiento disponible (color verde)</span>
                </li>
                <li className="flex items-start">
                  <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mr-2 mt-0.5">
                    <span className="text-blue-600 text-xs">2</span>
                  </div>
                  <span>Completa tus datos personales</span>
                </li>
                <li className="flex items-start">
                  <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mr-2 mt-0.5">
                    <span className="text-blue-600 text-xs">3</span>
                  </div>
                  <span>Haz clic en "Confirmar Reserva"</span>
                </li>
                <li className="flex items-start">
                  <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mr-2 mt-0.5">
                    <span className="text-blue-600 text-xs">4</span>
                  </div>
                  <span>Los líderes de tu barrio serán notificados</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="mb-2">Sistema de Reserva de Asientos de Autobús</p>
          <p className="text-gray-400 text-sm">Para asistencia, contacta a los líderes de tu barrio</p>
        </div>
      </footer>
    </div>
  )
}