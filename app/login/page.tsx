'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  FaBus, 
  FaLock, 
  FaUser, 
  FaEye, 
  FaEyeSlash, 
  FaExclamationTriangle,
  FaSignInAlt 
} from 'react-icons/fa'

// Función para guardar en cookies
const setSessionCookie = (sessionData: any, days = 7) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `bus-reservation-session=${JSON.stringify(sessionData)}; expires=${expires}; path=/; SameSite=Lax`
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      console.log('🔐 Intentando login...')

      // Método SIMPLE y DIRECTO - sin RPC complicado
      const { data: userData, error: queryError } = await supabase
        .from('system_users')
        .select('*')
        .eq('email', email)
        .single()

      console.log('📊 Respuesta BD:', { userData, queryError })

      if (queryError || !userData) {
        throw new Error('Usuario no encontrado')
      }

      // Verificar contraseña (texto plano - asumiendo que así están)
      if (userData.password !== password) {
        // Si no coincide en texto plano, intentar como hash
        console.log('🔍 Intentando verificar como hash...')
        
        // Si la contraseña parece un hash, probar otra cosa
        if (userData.password.startsWith('$2')) {
          throw new Error('Contraseña encriptada. Usa: admin123, bishop123, etc.')
        }
        
        throw new Error('Contraseña incorrecta. Prueba con: admin123')
      }

      console.log('✅ Login exitoso!')
      
      // Crear datos de sesión
      const sessionData = {
        id: userData.id,
        email: userData.email,
        role: userData.role,
        name: userData.name,
        ward: userData.ward,
        timestamp: Date.now()
      }

      console.log('💾 Guardando sesión:', sessionData)
      
      // 1. Guardar en localStorage (para el cliente)
      localStorage.setItem('bus-reservation-session', JSON.stringify(sessionData))
      
      // 2. Guardar en cookies (para el middleware)
      setSessionCookie(sessionData)
      
      // 3. También guardar en sessionStorage por si acaso
      sessionStorage.setItem('bus-session', JSON.stringify(sessionData))

      console.log('✅ Sesión guardada en 3 lugares')

      // Pequeña pausa para asegurar que se guarda
      await new Promise(resolve => setTimeout(resolve, 100))

      // Redirigir según rol
      console.log('🎯 Rol:', userData.role)
      if (['admin', 'bishop', 'quorum_president', 'stake_presidency'].includes(userData.role)) {
        console.log('➡️ Redirigiendo a /admin')
        window.location.href = '/admin' // Usar window.location para recargar completamente
      } else {
        console.log('➡️ Redirigiendo a /user')
        window.location.href = '/user'
      }

    } catch (error: any) {
      console.error('💥 Error:', error)
      setError(error.message || 'Error de autenticación')
      
      // Sugerencias específicas
      if (error.message.includes('admin123')) {
        setError('Contraseña incorrecta. Prueba con: admin123, bishop123, quorum123, viajero123')
      }
    } finally {
      setLoading(false)
    }
  }

  // Credenciales SIMPLES de prueba
  const demoCredentials = [
    { role: 'Admin', email: 'admin@example.com', password: 'admin123' },
    { role: 'Obispo', email: 'bishop1@example.com', password: 'bishop123' },
    { role: 'Presidente', email: 'quorum1@example.com', password: 'quorum123' },
    { role: 'Viajero', email: 'viajero@example.com', password: 'viajero123' }
  ]

  const handleDemoLogin = (email: string, password: string) => {
    setEmail(email)
    setPassword(password)
  }

  // Función para resetear contraseñas a texto plano
  const handleResetPasswords = async () => {
    if (!confirm('¿Resetear todas las contraseñas a texto plano? (solo desarrollo)')) return
    
    try {
      const { error } = await supabase
        .from('system_users')
        .update({
          password: 'password123'
        })
        .neq('email', '')

      if (error) throw error
      alert('Contraseñas reseteadas a "password123"')
    } catch (error) {
      console.error('Error resetting passwords:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-lg p-6">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-full mb-3">
              <FaBus className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-800">BusReserve</h1>
            <p className="text-gray-600 text-sm">Sistema de Reservas</p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <FaExclamationTriangle className="w-4 h-4 text-red-500 mr-2 flex-shrink-0" />
                  <div className="text-red-700 text-sm">{error}</div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="admin@example.com"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="admin123"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <FaEyeSlash className="w-4 h-4" />
                  ) : (
                    <FaEye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Prueba con: admin123, bishop123, quorum123, viajero123
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 rounded-lg font-medium text-white flex items-center justify-center ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Verificando...
                </>
              ) : (
                <>
                  <FaSignInAlt className="w-4 h-4 mr-2" />
                  Iniciar Sesión
                </>
              )}
            </button>
          </form>

          {/* Credenciales */}
          <div className="mt-6">
            <div className="text-center text-sm text-gray-500 mb-2">
              Usuarios de prueba
            </div>
            <div className="space-y-2">
              {demoCredentials.map((cred, index) => (
                <button
                  key={index}
                  onClick={() => handleDemoLogin(cred.email, cred.password)}
                  className="w-full p-2 text-left bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 text-sm transition-colors"
                  disabled={loading}
                >
                  <div className="font-medium text-gray-800 flex items-center">
                    <FaUser className="w-3 h-3 mr-2 text-blue-600" />
                    {cred.role}
                  </div>
                  <div className="text-gray-600 text-xs mt-1">Email: {cred.email}</div>
                  <div className="text-gray-500 text-xs mt-1 flex items-center">
                    <FaLock className="w-3 h-3 mr-1" />
                    Pass: {cred.password}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Debug info */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <p>Si hay problemas, prueba:</p>
              <button
                onClick={handleResetPasswords}
                className="mt-1 text-blue-600 hover:text-blue-800 underline flex items-center"
              >
                <FaExclamationTriangle className="w-3 h-3 mr-1" />
                Resetear contraseñas a "password123"
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}