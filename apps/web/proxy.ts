import { NextResponse, type NextRequest } from 'next/server';

// MVP auth for the KDS: reachable only from the local network (no passwords).
// The Pi and Victor's devices are on the truck LAN; the public tunnel is not.
// (Next 16 renamed the `middleware` convention to `proxy` — same behavior.)
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

export function proxy(req: NextRequest): NextResponse {
  const ip = clientIp(req);
  if (ip && LAN.some((re) => re.test(ip))) return NextResponse.next();
  return new NextResponse('KDS is available on the local network only.', { status: 403 });
}

export const config = {
  matcher: ['/kds/:path*'],
};
