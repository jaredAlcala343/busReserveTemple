'use client'

import { useState } from 'react'
import BusSeatMap from '@/components/BusSeatMap'
import { supabase } from '@/lib/supabase'
import { sendNotification } from '@/lib/utils'

// Definir la misma interfaz Seat que en BusSeatMap
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
          status: 'reserved'
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

      // 3. Enviar notificaciones
      await sendNotification({
        title: 'Nueva Reserva',
        message: `${formData.passenger_name} ha reservado el asiento ${selectedSeat.seat_number} (Barrio: ${formData.passenger_ward})`,
        type: 'reservation',
        ward: formData.passenger_ward,
        related_reservation_id: reservation.id
      })

      setSuccess(true)
      setSelectedSeat(null)
      setFormData({
        passenger_name: '',
        passenger_ward: '',
        email: '',
        phone: ''
      })

      // Resetear éxito después de 5 segundos
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Reserva de Asientos - Viaje Especial
          </h1>
          <p className="text-gray-600 text-lg">
            Selecciona tu asiento y completa la información para reservar
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Mapa de asientos */}
          <div>
            <BusSeatMap
              onSeatSelect={handleSeatSelect}
              selectedSeat={selectedSeat}
              reservationData={formData}
            />
          </div>

          {/* Formulario de reserva */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              {selectedSeat ? `Reservar Asiento ${selectedSeat.seat_number}` : 'Seleccione un Asiento'}
            </h2>

            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-800">¡Reserva Exitosa!</h3>
                    <p className="text-green-600 text-sm">
                      Su asiento ha sido reservado. Se ha notificado al líder correspondiente.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    name="passenger_name"
                    value={formData.passenger_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={!selectedSeat || loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Barrio *
                  </label>
                  <select
                    name="passenger_ward"
                    value={formData.passenger_ward}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={!selectedSeat || loading}
                  >
                    <option value="">Seleccione su barrio</option>
                    {wards.map(ward => (
                      <option key={ward} value={ward}>{ward}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!selectedSeat || loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!selectedSeat || loading}
                  />
                </div>

                {selectedSeat && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h3 className="font-semibold text-blue-800 mb-2">Resumen</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Asiento:</div>
                      <div className="font-medium">{selectedSeat.seat_number}</div>
                      <div>Fila:</div>
                      <div className="font-medium">{selectedSeat.row_number}</div>
                      <div>Posición:</div>
                      <div className="font-medium">
                        {selectedSeat.position === 'window' ? 'Ventana' : 
                         selectedSeat.position === 'aisle' ? 'Pasillo' : 'Centro'}
                      </div>
                      <div>Lado:</div>
                      <div className="font-medium">
                        {selectedSeat.side === 'left' ? 'Izquierdo' : 'Derecho'}
                      </div>
                      <div>Estado:</div>
                      <div className="font-medium">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          selectedSeat.status === 'available' ? 'bg-green-100 text-green-800' :
                          selectedSeat.status === 'reserved' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {selectedSeat.status === 'available' ? 'Disponible' :
                           selectedSeat.status === 'reserved' ? 'Reservado' : 'Pagado'}
                        </span>
                      </div>
                      <div>Nombre:</div>
                      <div className="font-medium">{formData.passenger_name || '-'}</div>
                      <div>Barrio:</div>
                      <div className="font-medium">{formData.passenger_ward || '-'}</div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!selectedSeat || loading || !formData.passenger_name || !formData.passenger_ward}
                  className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
                    !selectedSeat || loading || !formData.passenger_name || !formData.passenger_ward
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Procesando...
                    </div>
                  ) : (
                    'Confirmar Reserva'
                  )}
                </button>

                <div className="text-xs text-gray-500 mt-4">
                  <p>* Campos obligatorios</p>
                  <p className="mt-2">
                    Al reservar, se notificará automáticamente al obispo y presidente de quórum de su barrio.
                    La reserva debe ser confirmada y pagada dentro de las próximas 48 horas.
                  </p>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}