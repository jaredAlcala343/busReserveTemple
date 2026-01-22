import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  console.log(`🛡️ Middleware - Ruta: ${pathname}`)

  // Rutas protegidas
  const protectedRoutes = ['/admin', '/user']
  
  // Verificar si es una ruta protegida
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  
  if (isProtectedRoute) {
    console.log(`🔒 Ruta protegida: ${pathname}`)
    
    // Buscar sesión en COOKIES (prioridad)
    const sessionCookie = request.cookies.get('bus-reservation-session')
    
    if (sessionCookie) {
      console.log('✅ Sesión encontrada en cookies')
      try {
        const sessionData = JSON.parse(sessionCookie.value)
        console.log(`👤 Usuario: ${sessionData.email} (${sessionData.role})`)
        
        // Verificar roles para /admin
        if (pathname.startsWith('/admin')) {
          const allowedRoles = ['admin', 'bishop', 'quorum_president', 'stake_presidency']
          if (!allowedRoles.includes(sessionData.role)) {
            console.log(`🚫 Rol ${sessionData.role} no autorizado para /admin`)
            return NextResponse.redirect(new URL('/user', request.url))
          }
        }
        
        // Acceso autorizado
        console.log('✅ Acceso autorizado')
        return NextResponse.next()
      } catch (error) {
        console.error('❌ Error parseando cookie:', error)
      }
    }
    
    // Si no hay cookie, verificar headers o otros métodos
    console.log('❌ No hay sesión en cookies, redirigiendo a login')
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Si va a /login y ya tiene sesión, redirigir
  if (pathname === '/login') {
    const sessionCookie = request.cookies.get('bus-reservation-session')
    if (sessionCookie) {
      try {
        const sessionData = JSON.parse(sessionCookie.value)
        console.log(`🔄 Usuario ya autenticado, redirigiendo: ${sessionData.role}`)
        
        const redirectPath = ['admin', 'bishop', 'quorum_president', 'stake_presidency']
          .includes(sessionData.role) ? '/admin' : '/user'
        
        return NextResponse.redirect(new URL(redirectPath, request.url))
      } catch (error) {
        // Si hay error parseando, dejar en login
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}