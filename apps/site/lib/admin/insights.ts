import 'server-only';
import { revalidatePath } from 'next/cache';
import { desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AnalyticsDto, WebOrderDto, WebsiteToday } from '@barrio/site-contract';
import { watchSummary } from '@/components/admin/analytics/Heatmap';
import {
  cateringPipeline,
  orderHeat,
  referralPerformance,
  sinceDaysAgo,
  topPages,
  topReferrers,
  totals,
  visitHeat,
} from '@/lib/analytics';
import { db } from '@/lib/db/client';
import { webOrders } from '@/lib/db/schema';
import { paymentsMock } from '@/lib/env';
import { TIMEZONE } from '@/lib/format';
import { setOrderStatus } from '@/lib/orders/status';
import { getSettings } from '@/lib/status';
import { fail, invalid, ok, type Result } from './result';

// Web orders (manual status override), analytics and the "today" summary. No
// auth here: callers (admin server actions, admin API) check it first.

type Order = typeof webOrders.$inferSelect;

/** "Tonight" for the orders list = the last 16 hours, so a shift that crosses midnight stays together. */
export const tonightStart = (): Date => new Date(Date.now() - 16 * 3600_000);

export function webOrderDto(o: Order): WebOrderDto {
  return {
    id: o.id,
    code: o.code,
    status: o.status,
    customerName: o.customerName,
    phoneLast4: o.phone.slice(-4),
    smsOptIn: o.smsOptIn,
    readySmsSent: Boolean(o.readySmsSentAt),
    lines: o.lines.map((l) => ({
      qty: l.qty,
      itemName: l.itemName,
      variationName: l.variationName,
      modifiers: l.modifiers.map((m) => m.name),
      note: l.note ?? null,
    })),
    totalCents: o.totalCents,
    error: o.error,
    createdAt: o.createdAt.toISOString(),
  };
}

export async function tonightsOrders(): Promise<{ orders: WebOrderDto[]; paidCount: number; paidTotalCents: number; testMode: boolean }> {
  const orders = await db.select().from(webOrders).where(gte(webOrders.createdAt, tonightStart())).orderBy(desc(webOrders.createdAt)).limit(200);
  const paid = orders.filter((o) => o.paidAt);
  return {
    orders: orders.map(webOrderDto),
    paidCount: paid.length,
    paidTotalCents: paid.reduce((s, o) => s + o.totalCents, 0),
    testMode: paymentsMock(),
  };
}

const OVERRIDABLE = ['received', 'preparing', 'ready'] as const;
const OverrideSchema = z.object({
  id: z.uuid(),
  status: z.enum(['preparing', 'ready', 'picked_up', 'cancelled']),
});

/** Manual override (test mode, or when the KDS link is down). "Ready" texts the customer once. */
export async function overrideOrderStatus(input: unknown): Promise<Result<WebOrderDto>> {
  const parsed = OverrideSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const [current] = await db.select({ status: webOrders.status }).from(webOrders).where(eq(webOrders.id, parsed.data.id));
  if (!current) return fail('That order doesn’t exist.');
  if (!(OVERRIDABLE as readonly string[]).includes(current.status)) {
    return fail('That order is already finished, so its status can’t change here.');
  }
  const row = await setOrderStatus(parsed.data.id, parsed.data.status);
  if (!row) return fail('That order doesn’t exist.');
  revalidatePath('/', 'layout');
  return ok(webOrderDto(row));
}

const AnalyticsSchema = z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]) });

export async function analytics(input: unknown): Promise<Result<AnalyticsDto>> {
  const parsed = AnalyticsSchema.safeParse(input);
  if (!parsed.success) return fail('Pick 7, 30 or 90 days.');
  const { days } = parsed.data;
  const since = sinceDaysAgo(days);
  const [t, vHeat, oHeat, pages, refs, partners, pipeline] = await Promise.all([
    totals(since),
    visitHeat(since),
    orderHeat(since),
    topPages(since),
    topReferrers(since),
    referralPerformance(since),
    cateringPipeline(),
  ]);
  return ok({
    days,
    totals: t,
    visitHeat: vHeat,
    orderHeat: oHeat,
    watch: { visits: watchSummary(vHeat), orders: watchSummary(oHeat) },
    topPages: pages,
    topReferrers: refs,
    partners,
    pipeline,
  });
}

/** Tonight at a glance. "Tonight" = since 5 AM local (a night runs 5 AM → 5 AM). */
export async function today(): Promise<WebsiteToday> {
  const settings = await getSettings();
  const [c] = await db.execute<{
    orders: number;
    revenue: number;
    new_leads: number;
    leads: number;
    photos: number;
    takedowns: number;
    to_ship: number;
  }>(sql`
    with night as (
      select ((date_trunc('day', (now() at time zone ${TIMEZONE}) - interval '5 hours') + interval '5 hours') at time zone ${TIMEZONE}) as start
    )
    select
      (select count(*)::int from web_orders, night where created_at >= night.start and status in ('received','preparing','ready','picked_up')) as orders,
      (select coalesce(sum(total_cents),0)::int from web_orders, night where created_at >= night.start and status in ('received','preparing','ready','picked_up')) as revenue,
      (select count(*)::int from catering_leads where status = 'new') as new_leads,
      (select count(*)::int from catering_leads where status in ('new','contacted','quoted')) as leads,
      (select count(*)::int from gallery_photos where status = 'pending') as photos,
      (select count(*)::int from takedown_requests where status = 'open') as takedowns,
      (select count(*)::int from merch_orders where status = 'paid') as to_ship`);
  return {
    status: settings.status,
    statusMessage: settings.statusMessage,
    orderingPaused: settings.orderingPaused,
    pausedMessage: settings.pausedMessage,
    ordersTonight: c?.orders ?? 0,
    revenueTonightCents: c?.revenue ?? 0,
    newLeads: c?.new_leads ?? 0,
    openLeads: c?.leads ?? 0,
    photosPending: c?.photos ?? 0,
    takedownsOpen: c?.takedowns ?? 0,
    merchToShip: c?.to_ship ?? 0,
  };
}
