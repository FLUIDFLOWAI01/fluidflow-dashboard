import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from './lib/auth';

// Everything except the login page and the login API requires a valid session cookie.
// (Each API route ALSO checks the database and the company, see lib/scope.ts.)
const PUBLIC_PATHS = ['/login', '/api/login'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    const adminOnly = pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin');
    if (adminOnly && session.role !== 'platform_admin') {
      if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
