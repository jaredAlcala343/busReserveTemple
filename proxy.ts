import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Rutas protegidas
  const protectedRoutes = ['/admin', '/user']
  
  // Verificar si es una ruta protegida
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  
  if (isProtectedRoute) {
    // Buscar sesión en cookies
    const sessionCookie = request.cookies.get('bus-reservation-session')
    
    if (!sessionCookie) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }

    try {
      const sessionData = JSON.parse(sessionCookie.value)
      
      // Verificar roles para /admin
      if (pathname.startsWith('/admin')) {
        const allowedRoles = ['admin', 'bishop', 'quorum_president', 'stake_presidency']
        if (!allowedRoles.includes(sessionData.role)) {
          return NextResponse.redirect(new URL('/user', request.url))
        }
      }
      
    } catch (error) {
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

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}