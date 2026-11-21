import { NextResponse, type NextRequest } from 'next/server';
import { adminRoutes } from '@/config/routes';

const sessionCookieName = process.env.AUTH_SESSION_COOKIE_NAME ?? 'fs_admin_session';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(sessionCookieName)?.value;
  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  let authenticated = false;

  if (sessionToken && backendUrl) {
    try {
      const response = await fetch(`${backendUrl}/auth/session`, {
        headers: { cookie: `${sessionCookieName}=${encodeURIComponent(sessionToken)}` },
        cache: 'no-store',
      });
      authenticated = response.ok;
    } catch {
      authenticated = false;
    }
  }

  if (pathname === adminRoutes.login) {
    return authenticated ? NextResponse.redirect(new URL(adminRoutes.dashboard, request.url)) : NextResponse.next();
  }
  return authenticated ? NextResponse.next() : NextResponse.redirect(new URL(`${adminRoutes.login}?from=${encodeURIComponent(pathname)}`, request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
