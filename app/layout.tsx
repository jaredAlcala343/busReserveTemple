import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Sistema de Reserva de Autobús',
  description: 'Sistema de reserva de asientos de autobús para eventos especiales',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <nav className="bg-white shadow">
            <div className="container mx-auto px-4">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center">
                  <div className="text-2xl font-bold text-blue-600">BusReserve</div>
                  <div className="ml-10 flex space-x-8">
                    <a href="/user" className="text-gray-700 hover:text-blue-600 font-medium">
                      Reservar Asiento
                    </a>
                    <a href="/admin" className="text-gray-700 hover:text-blue-600 font-medium">
                      Panel Admin
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </nav>
          <main>{children}</main>
          <footer className="bg-gray-800 text-white py-8 mt-12">
            <div className="container mx-auto px-4 text-center">
              <p>Sistema de Reserva de Autobús - Todos los derechos reservados © {new Date().getFullYear()}</p>
              <p className="text-gray-400 mt-2">Desarrollado para eventos especiales de la estaca</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}