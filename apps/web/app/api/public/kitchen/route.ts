import { NextResponse } from 'next/server';
import { and, avg, count, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { kitchenTickets } from '@/lib/db/schema';

// Kitchen load for the customer website's "ready in ~N min" estimate.
// Reachable through the tunnel; if KITCHEN_API_TOKEN is set, callers must send
// it as a bearer token. Returns counts only — no order details.
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<NextResponse> {
  const token = process.env.KITCHEN_API_TOKEN;
  if (token && req.headers.get('authorization') !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const twoHoursAgo = new Date(Date.now() - 2 * 3600_000);
  const [[active], [done]] = await Promise.all([
    db.select({ n: count() }).from(kitchenTickets).where(inArray(kitchenTickets.state, ['pending', 'in_progress'])),
    db
      .select({
        avg: avg(sql<number>`extract(epoch from (${kitchenTickets.completedAt} - ${kitchenTickets.startedAt}))`),
      })
      .from(kitchenTickets)
      .where(and(eq(kitchenTickets.state, 'done'), gte(kitchenTickets.completedAt, twoHoursAgo))),
  ]);
  const avgSeconds = done?.avg == null ? null : Math.round(Number(done.avg));
  return NextResponse.json(
    { activeTickets: active?.n ?? 0, avgTicketSeconds: avgSeconds },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
