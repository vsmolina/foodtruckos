import { NextResponse, type NextRequest } from 'next/server';

// Next 16 renamed the `middleware` convention to `proxy` (same behavior). Only
// one proxy file is allowed per app, so it guards two surfaces:
//
//  1. /kds        — LAN-only (no passwords). The Pi and Victor's devices are on
//                   the truck LAN; the public tunnel is not.
//  2. dashboard   — signed-in admin only. This is an OPTIMISTIC check: with the
//     (/, /orders,  database session strategy the cookie is an opaque token, so
//      /reports,    we only verify its presence here and redirect to /login when
//      /settings)   absent. The authoritative check is `await auth()` in the
//                   (dashboard) layout.

const LAN = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0 – 172.31.255.255
  /^::1$/,
  /^::ffff:127\./,
  /^::ffff:10\./,
  /^::ffff:192\.168\./,
];

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? '';
}

function hasSessionCookie(req: NextRequest): boolean {
  // Auth.js cookie name is `__Secure-`-prefixed only over HTTPS; on the LAN the
  // dashboard is plain HTTP, so accept both.
  return (
    req.cookies.has('authjs.session-token') ||
    req.cookies.has('__Secure-authjs.session-token')
  );
}

export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/kds')) {
    const ip = clientIp(req);
    if (ip && LAN.some((re) => re.test(ip))) return NextResponse.next();
    return new NextResponse('KDS is available on the local network only.', { status: 403 });
  }

  // Everything else the matcher sends here is a dashboard route.
  if (!hasSessionCookie(req)) {
    const url = new URL('/login', req.nextUrl);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/kds/:path*', '/', '/orders/:path*', '/reports/:path*', '/settings/:path*'],
};
