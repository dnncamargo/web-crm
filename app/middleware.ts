import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value

  // Se estiver na home '/', redireciona para /dashboard
  if (request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Protege rotas específicas
  const protectedPaths = ['/dashboard', '/people-directory', '/events-history', '/task-list']

  const isProtectedRoute = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))

  if (isProtectedRoute) {
    if (!token) {
      return NextResponse.redirect(new URL('/auth-login', request.url))
    }
  }
 
      // opcional: validar token no servidor
    // try {
    //   await verifyIdToken(token)
    // } catch (error) {
    //   return NextResponse.redirect(new URL('/auth-login', request.url))
    // }

  return NextResponse.next()
}

// Definir onde o middleware deve atuar
export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/people-directory/:path*',
    '/events-history/:path*',
    '/task-list/:path*',
    '/task-list-2/:path*',
  ],
}
