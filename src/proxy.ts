import { NextResponse, type NextRequest } from 'next/server';
import { adminRoutes } from '@/config/routes';
import { logAuthDiagnostic, safeRequestId } from '@/lib/auth-diagnostics';

const sessionCookieName = process.env.AUTH_SESSION_COOKIE_NAME ?? 'fs_admin_session';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = safeRequestId(request.headers.get('x-request-id'));
  const sessionCookiePresent = request.cookies.has(sessionCookieName);
  const csrfCookiePresent = request.cookies.has('fs_admin_csrf');
  // API requests pass through to the backend and should not enter the page redirect flow.
  if (pathname === '/api/v1' || pathname.startsWith('/api/v1/')) {
    logAuthDiagnostic('api_proxy_forward', { requestId, path: pathname, sessionCookiePresent, csrfCookiePresent, status: 0 });
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
        headers: { cookie: `${sessionCookieName}=${encodeURIComponent(sessionToken)}`, 'x-request-id': requestId },
        cache: 'no-store',
      });
      authenticated = response.ok;
      logAuthDiagnostic('server_session_verification', { requestId, path: pathname, status: response.status, sessionCookiePresent, csrfCookiePresent });
    } catch {
      authenticated = false;
      logAuthDiagnostic('server_session_verification_error', { requestId, path: pathname, status: 0, sessionCookiePresent, csrfCookiePresent });
    }
  } else {
    logAuthDiagnostic('server_session_verification_skipped', { requestId, path: pathname, status: 0, sessionCookiePresent, csrfCookiePresent });
  }

  if (pathname === adminRoutes.login) {
    const destination = new URL(adminRoutes.dashboard, request.url).pathname;
    logAuthDiagnostic('login_route_decision', { requestId, path: pathname, status: authenticated ? 307 : 200, sessionCookiePresent, csrfCookiePresent, destination: authenticated ? destination : null });
    return authenticated ? NextResponse.redirect(new URL(destination, request.url)) : NextResponse.next();
  }
  const destination = `${adminRoutes.login}?from=${encodeURIComponent(pathname)}`;
  logAuthDiagnostic('protected_route_decision', { requestId, path: pathname, status: authenticated ? 200 : 307, sessionCookiePresent, csrfCookiePresent, destination: authenticated ? null : destination });
  return authenticated ? NextResponse.next() : NextResponse.redirect(new URL(destination, request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
