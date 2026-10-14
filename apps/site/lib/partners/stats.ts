import 'server-only';
import { and, count, gte, inArray, notInArray, sum } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { partnerVisits, webOrders } from '@/lib/db/schema';

export type PartnerStats = { visits30: number; orders: number; revenueCents: number };

/** Visits in the last 30 days and all-time attributed (paid) web orders per partner. */
export async function partnerStats(ids: string[]): Promise<Map<string, PartnerStats>> {
  const out = new Map<string, PartnerStats>(ids.map((id) => [id, { visits30: 0, orders: 0, revenueCents: 0 }]));
  if (ids.length === 0) return out;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [visits, orders] = await Promise.all([
    db
      .select({ id: partnerVisits.partnerId, n: count() })
      .from(partnerVisits)
      .where(and(inArray(partnerVisits.partnerId, ids), gte(partnerVisits.at, since)))
      .groupBy(partnerVisits.partnerId),
    db
      .select({ id: webOrders.partnerId, n: count(), cents: sum(webOrders.totalCents) })
      .from(webOrders)
      .where(and(inArray(webOrders.partnerId, ids), notInArray(webOrders.status, ['failed', 'pending_payment', 'cancelled'])))
      .groupBy(webOrders.partnerId),
  ]);
  for (const v of visits) out.get(v.id)!.visits30 = v.n;
  for (const o of orders) if (o.id) Object.assign(out.get(o.id)!, { orders: o.n, revenueCents: Number(o.cents ?? 0) });
  return out;
}
