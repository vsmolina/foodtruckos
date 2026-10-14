import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

// The truck dashboard (apps/web) calls the admin API server-to-server with
// `Authorization: Bearer $SITE_ADMIN_API_TOKEN`. The token is full admin, so it
// must be long and random, and the API is off when it isn't set.

const MIN_LENGTH = 32;

export function adminApiEnabled(): boolean {
  return (process.env.SITE_ADMIN_API_TOKEN ?? '').length >= MIN_LENGTH;
}

export function adminApiAuthorized(req: Request): boolean {
  const token = process.env.SITE_ADMIN_API_TOKEN ?? '';
  if (token.length < MIN_LENGTH) return false;
  const given = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  // Compare digests so length differences don't leak through timing.
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(token).digest();
  return timingSafeEqual(a, b);
}
