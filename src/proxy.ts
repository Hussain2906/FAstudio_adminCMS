import { NextResponse, type NextRequest } from 'next/server';
import { adminRoutes } from '@/config/routes';

const sessionCookieName = process.env.AUTH_SESSION_COOKIE_NAME ?? 'fs_admin_session';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // API requests pass through to the backend and should not enter the page redirect flow.
  if (pathname === '/api/v1' || pathname.startsWith('/api/v1/')) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(sessionCookieName)?.value;
  const backendUrl =
    process.env.NEXT_PUBLIC_API_URL ??
    'https://fa-studio-backend-452750258410.northamerica-northeast2.run.app/api/v1';
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
