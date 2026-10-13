import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { refreshIfStale } from '@/lib/instagram';

// Daily Vercel cron (vercel.json): keeps the Instagram posts fresh and the
// token renewed even if nobody opens the gallery for weeks. Vercel sends
// `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET this is off.

const digest = (s: string): Buffer => createHash('sha256').update(s).digest();

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!secret || !timingSafeEqual(digest(given), digest(secret))) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  await refreshIfStale();
  return NextResponse.json({ ok: true });
}
