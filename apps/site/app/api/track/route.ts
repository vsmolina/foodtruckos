import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { pageViews } from '@/lib/db/schema';

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse/i;

export async function POST(req: Request): Promise<NextResponse> {
  try {
    if (BOT.test(req.headers.get('user-agent') ?? '')) return new NextResponse(null, { status: 204 });
    const { path, ref } = (await req.json()) as { path?: unknown; ref?: unknown };
    if (typeof path !== 'string' || !path.startsWith('/') || path.length > 200 || path.startsWith('/admin')) {
      return new NextResponse(null, { status: 204 });
    }
    await db.insert(pageViews).values({
      path,
      referrerHost: typeof ref === 'string' && ref ? ref.slice(0, 100) : null,
    });
  } catch {
    /* ignore */
  }
  return new NextResponse(null, { status: 204 });
}
