import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  console.log(`🔒 Proxy: Ruta ${pathname}`)

  // SOLO proteger /admin (no /user)
  if (pathname.startsWith('/admin')) {
    // Buscar sesión en cookies
    const sessionCookie = request.cookies.get('bus-reservation-session')
    
    if (!sessionCookie) {
      console.log('❌ No hay sesión para /admin, redirigiendo a login')
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }

    try {
      const sessionData = JSON.parse(sessionCookie.value)
      
      // Verificar roles para /admin
      const allowedRoles = ['admin', 'bishop', 'quorum_president', 'stake_presidency']
      if (!allowedRoles.includes(sessionData.role)) {
        console.log(`🚫 Rol no autorizado para /admin: ${sessionData.role}`)
        return NextResponse.redirect(new URL('/user', request.url))
      }
      
    } catch (error) {
      console.error('❌ Error parseando cookie:', error)
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Si ya está logueado y va a /login, redirigir según rol
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

// Export también como default para compatibilidad
export default proxy

export const config = {
  matcher: [
    // Solo aplica a /admin y /login (no a /user)
    '/admin/:path*',
    '/login',
  ],
}