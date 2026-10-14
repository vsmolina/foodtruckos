import { timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { siteSettings } from '@/lib/db/schema';
import { getSettings } from '@/lib/status';

// Lets the truck's POS / foodtruck-os set the website's status.
//   POST /api/integrations/status
//   Authorization: Bearer $SITE_INTEGRATION_TOKEN
//   {"status":"open"|"closed"|"back_soon", "message"?: string|null, "orderingPaused"?: boolean}
// GET returns the current status (same auth).

const Body = z.object({
  status: z.enum(['open', 'closed', 'back_soon']).optional(),
  message: z.string().trim().max(200).nullable().optional(),
  orderingPaused: z.boolean().optional(),
});

function authorized(req: Request): boolean {
  const token = process.env.SITE_INTEGRATION_TOKEN;
  if (!token) return false;
  const given = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request): Promise<NextResponse> {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const s = await getSettings();
  return NextResponse.json({ status: s.status, message: s.statusMessage, orderingPaused: s.orderingPaused, updatedAt: s.updatedAt });
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body', issues: parsed.error.issues }, { status: 400 });
  const { status, message, orderingPaused } = parsed.data;
  await getSettings();
  await db
    .update(siteSettings)
    .set({
      ...(status ? { status } : {}),
      ...(message !== undefined ? { statusMessage: message } : {}),
      ...(orderingPaused !== undefined ? { orderingPaused } : {}),
    })
    .where(eq(siteSettings.id, 1));
  revalidatePath('/', 'layout');
  const s = await getSettings();
  return NextResponse.json({ status: s.status, message: s.statusMessage, orderingPaused: s.orderingPaused });
}
