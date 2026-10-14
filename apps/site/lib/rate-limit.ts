import 'server-only';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { rateLimits } from '@/lib/db/schema';

/** The caller's IP, hashed (never stored raw). */
export async function clientKey(): Promise<string> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  return createHash('sha256')
    .update(`${process.env.SESSION_SECRET ?? 'dev'}:${ip}`)
    .digest('hex')
    .slice(0, 24);
}

/**
 * Fixed-window limiter in Postgres so it holds across serverless instances.
 * Returns true when the call is allowed.
 */
export async function rateLimit(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  const key = `${bucket}:${await clientKey()}`;
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  // Opportunistic cleanup of old windows (cheap, indexed by PK prefix scan).
  if (Math.random() < 0.02) {
    await db.execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`);
  }
  return (row?.count ?? 1) <= limit;
}

/** Honeypot: a hidden field real people never fill. */
export function isBot(form: FormData): boolean {
  const trap = form.get('company_website');
  return typeof trap === 'string' && trap.trim() !== '';
}

/** Current count in this window without incrementing (for failure-only limits). */
export async function rateLimitCount(bucket: string, windowSeconds: number): Promise<number> {
  const key = `${bucket}:${await clientKey()}`;
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const rows = await db.execute<{ count: number }>(
    sql`select count from rate_limits where key = ${key} and window_start = ${windowStart.toISOString()}`,
  );
  return Number(rows[0]?.count ?? 0);
}
