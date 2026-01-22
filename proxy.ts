import { NextRequest, NextResponse } from 'next/server'

// Exporta como "proxy" no "middleware"
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  console.log(`🔒 Verificando acceso a: ${pathname}`)

  // Rutas protegidas
  const protectedRoutes = ['/admin', '/user']
  
  // Verificar si es una ruta protegida
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  
  if (isProtectedRoute) {
    // Buscar sesión en cookies
    const sessionCookie = request.cookies.get('bus-reservation-session')
    
    if (!sessionCookie) {
      console.log('❌ No hay sesión, redirigiendo a login')
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }

    try {
      const sessionData = JSON.parse(sessionCookie.value)
      
      // Verificar roles para /admin
      if (pathname.startsWith('/admin')) {
        const allowedRoles = ['admin', 'bishop', 'quorum_president', 'stake_presidency']
        if (!allowedRoles.includes(sessionData.role)) {
          console.log(`🚫 Rol no autorizado: ${sessionData.role}`)
          return NextResponse.redirect(new URL('/user', request.url))
        }
      }
      
    } catch (error) {
      console.error('❌ Error parseando cookie:', error)
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Si ya está logueado y va a /login, redirigir
  if (pathname === '/login') {
    const sessionCookie = request.cookies.get('bus-reservation-session')
    if (sessionCookie) {
      try {
        const sessionData = JSON.parse(sessionCookie.value)
        
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

// También puedes exportar como default
export default proxy

// Configuración para rutas protegidas
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}