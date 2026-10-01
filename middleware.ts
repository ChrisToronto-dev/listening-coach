import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from './lib/auth-token';

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 1. Allow public static assets and auth paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/audio') ||
    pathname.startsWith('/favicon.ico') ||
    pathname === '/login' ||
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/logout' ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|wav|mp3|ico|css|js)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. Allow ChatGPT Sites direct headers if present
  if (
    req.headers.get('oai-authenticated-user-id') &&
    req.headers.get('oai-authenticated-user-email')
  ) {
    return NextResponse.next();
  }

  // 3. In non-production local dev without password, allow pass-through
  if (process.env.NODE_ENV !== 'production' && !process.env.APP_PASSWORD) {
    return NextResponse.next();
  }

  // 4. Verify session cookie
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (session) {
    return NextResponse.next();
  }

  // 5. If unauthorized API route -> return 401 JSON
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'AUTH' }, { status: 401 });
  }

  // 6. If unauthorized page -> redirect to /login
  const returnTo = pathname + (search || '');
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('return_to', returnTo);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
