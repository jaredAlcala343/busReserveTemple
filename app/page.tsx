'use client'

import { useState, useEffect } from 'react'
import { Bus, Users, Shield, Clock, MapPin, CheckCircle, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const [availableSeats, setAvailableSeats] = useState(0)
  const [totalReservations, setTotalReservations] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      // Obtener asientos disponibles
      const { data: seatsData } = await supabase
        .from('bus_seats')
        .select('status')
      
      const available = seatsData?.filter(seat => seat.status === 'available').length || 0
      setAvailableSeats(available)

      // Obtener total de reservas
      const { data: reservationsData } = await supabase
        .from('reservations')
        .select('id')
      
      setTotalReservations(reservationsData?.length || 0)
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const features = [
    {
      icon: <Bus className="w-8 h-8" />,
      title: "Reserva en Tiempo Real",
      description: "Selecciona tu asiento al instante con nuestro mapa interactivo"
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Sistema Seguro",
      description: "Autenticación por roles y confirmación de líderes"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Gestión por Barrios",
      description: "Los líderes pueden ver y confirmar las reservas de su unidad"
    },
    {
      icon: <Clock className="w-8 h-8" />,
      title: "Notificaciones Instantáneas",
      description: "Alertas automáticas a obispos y presidentes de quórum"
    }
  ]

  const steps = [
    {
      number: "01",
      title: "Selecciona tu asiento",
      description: "Elige el asiento que prefieras en nuestro mapa interactivo"
    },
    {
      number: "02",
      title: "Completa tus datos",
      description: "Ingresa tu nombre y barrio para la reserva"
    },
    {
      number: "03",
      title: "Notificación automática",
      description: "Los líderes de tu barrio recibirán la solicitud"
    },
    {
      number: "04",
      title: "Confirmación y pago",
      description: "Los líderes confirman y registran el pago"
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-700 opacity-10"></div>
        <div className="container mx-auto px-4 py-16 relative">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h1 className="text-5xl font-bold text-gray-800 mb-6 leading-tight">
                  Sistema de Reserva de 
                  <span className="text-blue-600"> Asientos de Autobús</span>
                </h1>
                <p className="text-xl text-gray-600 mb-8">
                  Plataforma completa para gestionar las reservas de viajes especiales. 
                  Diseñado para estacas y barrios con control de líderes y confirmaciones.
                </p>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => router.push('/user')}
                    className="px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <span>Reservar Mi Asiento</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => router.push('/login')}
                    className="px-8 py-4 bg-white text-blue-600 border-2 border-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
                  >
                    Acceso para Líderes
                  </button>
                </div>
              </div>
              <div className="relative">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-8 shadow-2xl transform rotate-3">
                  <div className="bg-white rounded-xl p-6 transform -rotate-3 shadow-lg">
                    <div className="text-center mb-6">
                      <Bus className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                      <h3 className="text-2xl font-bold text-gray-800">Estadísticas en Vivo</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-3xl font-bold text-blue-600">{availableSeats}</div>
                        <div className="text-sm text-gray-600">Asientos Disponibles</div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-3xl font-bold text-green-600">{totalReservations}</div>
                        <div className="text-sm text-gray-600">Reservas Totales</div>
                      </div>
                    </div>
                    <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-sm text-yellow-800">
                        <CheckCircle className="w-4 h-4 inline mr-2" />
                        Sistema activo y funcionando
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Características Principales</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Diseñado específicamente para las necesidades de organización de eventos de estaca
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">¿Cómo Funciona?</h2>
            <p className="text-blue-100 max-w-2xl mx-auto">
              Proceso simple y eficiente para garantizar una experiencia perfecta
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="bg-white p-6 rounded-xl shadow-lg">
                  <div className="text-4xl font-bold text-blue-600 mb-4">{step.number}</div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">{step.title}</h3>
                  <p className="text-gray-600">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2">
                    <ArrowRight className="w-8 h-8 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Roles Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Acceso por Roles</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Diferentes niveles de acceso según tus responsabilidades
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              role: "Viajero",
              description: "Reserva tu asiento y completa tus datos",
              color: "from-green-500 to-emerald-600",
              permissions: ["Seleccionar asientos", "Ver disponibilidad", "Recibir confirmaciones"]
            },
            {
              role: "Obispo",
              description: "Supervisa las reservas de tu barrio",
              color: "from-blue-500 to-cyan-600",
              permissions: ["Ver reservas del barrio", "Confirmar pagos", "Recibir notificaciones"]
            },
            {
              role: "Presidente de Quórum",
              description: "Apoya en la gestión de reservas",
              color: "from-purple-500 to-violet-600",
              permissions: ["Ver reservas", "Asistir confirmaciones", "Reportar problemas"]
            },
            {
              role: "Administrador",
              description: "Gestión completa del sistema",
              color: "from-red-500 to-pink-600",
              permissions: ["Todos los permisos", "Gestión de usuarios", "Reportes completos"]
            }
          ].map((role, index) => (
            <div key={index} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
              <div className={`h-2 bg-gradient-to-r ${role.color}`}></div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-2">{role.role}</h3>
                <p className="text-gray-600 mb-4">{role.description}</p>
                <ul className="space-y-2">
                  {role.permissions.map((permission, idx) => (
                    <li key={idx} className="flex items-center text-sm text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      {permission}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => router.push('/login')}
                  className={`mt-6 w-full py-2 rounded-lg font-semibold bg-gradient-to-r ${role.color} text-white hover:opacity-90 transition-opacity`}
                >
                  Acceder como {role.role}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            ¿Listo para reservar tu asiento?
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            Únete a cientos de personas que ya han reservado su lugar para el próximo viaje especial
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => router.push('/user')}
              className="px-8 py-3 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
            >
              Comenzar Reserva
            </button>
            <button
              onClick={() => router.push('/login')}
              className="px-8 py-3 bg-transparent border-2 border-white text-white rounded-xl font-semibold hover:bg-white/10 transition-colors"
            >
              Acceso para Líderes
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <Bus className="w-8 h-8 text-blue-400 mr-2" />
                <span className="text-xl font-bold">BusReserve</span>
              </div>
              <p className="text-gray-400">
                Sistema de reserva de asientos de autobús para eventos especiales de estaca.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Enlaces Rápidos</h4>
              <ul className="space-y-2">
                <li><a href="/user" className="text-gray-400 hover:text-white transition-colors">Reservar Asiento</a></li>
                <li><a href="/login" className="text-gray-400 hover:text-white transition-colors">Panel de Control</a></li>
                <li><a href="/admin" className="text-gray-400 hover:text-white transition-colors">Administración</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contacto</h4>
              <p className="text-gray-400">
                Para soporte técnico o consultas, contacta a la presidencia de estaca.
              </p>
              <p className="text-gray-400 mt-2">
                Sistema desarrollado para la organización de viajes especiales.
              </p>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>© {new Date().getFullYear()} BusReserve System. Todos los derechos reservados.</p>
            <p className="mt-2 text-sm">Versión 1.0.0</p>
          </div>
        </div>
      </footer>
    </div>
  )
}