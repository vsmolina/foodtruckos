import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { TIMEZONE } from '@/lib/format';

// All times bucketed in the truck's timezone. A "night" runs 5 AM → 5 AM, so a
// 1 AM order on Saturday counts toward Friday night — that's how the truck
// thinks about its week.

/** postgres-js can't bind a Date inside raw `sql`; send ISO text and cast. */
const iso = (d: Date) => d.toISOString();

const PAID = `('received','preparing','ready','picked_up')`;

export type Cell = { day: number; hour: number; n: number }; // day: 1 = Mon … 7 = Sun (night it started)

async function heat(table: 'page_views' | 'web_orders', since: Date): Promise<Cell[]> {
  const col = table === 'page_views' ? sql.raw('at') : sql.raw('created_at');
  const extra = table === 'web_orders' ? sql.raw(`and status in ${PAID}`) : sql.raw('');
  const rows = await db.execute<{ day: number; hour: number; n: number }>(sql`
    select extract(isodow from (${col} at time zone ${TIMEZONE}) - interval '5 hours')::int as day,
           extract(hour from ${col} at time zone ${TIMEZONE})::int as hour,
           count(*)::int as n
    from ${sql.raw(table)}
    where ${col} >= ${iso(since)}::timestamptz ${extra}
    group by 1, 2`);
  return [...rows];
}

export const visitHeat = (since: Date) => heat('page_views', since);
export const orderHeat = (since: Date) => heat('web_orders', since);

export async function totals(
  since: Date,
): Promise<{
  views: number;
  orders: number;
  revenueCents: number;
  merchCents: number;
  merchOrders: number;
}> {
  const [r] = await db.execute<{
    views: number;
    orders: number;
    revenue: number;
    merch: number;
    merch_orders: number;
  }>(sql`
    select
      (select count(*)::int from page_views where at >= ${iso(since)}::timestamptz) as views,
      (select count(*)::int from web_orders where created_at >= ${iso(since)}::timestamptz and status in ${sql.raw(PAID)}) as orders,
      (select coalesce(sum(total_cents), 0)::int from web_orders where created_at >= ${iso(since)}::timestamptz and status in ${sql.raw(PAID)}) as revenue,
      (select coalesce(sum(total_cents), 0)::int from merch_orders where created_at >= ${iso(since)}::timestamptz and status in ('paid','fulfilled')) as merch,
      (select count(*)::int from merch_orders where created_at >= ${iso(since)}::timestamptz and status in ('paid','fulfilled')) as merch_orders`);
  return {
    views: r?.views ?? 0,
    orders: r?.orders ?? 0,
    revenueCents: r?.revenue ?? 0,
    merchCents: r?.merch ?? 0,
    merchOrders: r?.merch_orders ?? 0,
  };
}

export async function topPages(
  since: Date,
  limit = 8,
): Promise<Array<{ label: string; n: number }>> {
  const rows = await db.execute<{ label: string; n: number }>(sql`
    select path as label, count(*)::int as n from page_views where at >= ${iso(since)}::timestamptz
    group by path order by n desc limit ${limit}`);
  return [...rows];
}

export async function topReferrers(
  since: Date,
  limit = 8,
): Promise<Array<{ label: string; n: number }>> {
  const rows = await db.execute<{ label: string; n: number }>(sql`
    select referrer_host as label, count(*)::int as n from page_views
    where at >= ${iso(since)}::timestamptz and referrer_host is not null
    group by referrer_host order by n desc limit ${limit}`);
  return [...rows];
}

export type ReferralRow = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  visits: number;
  orders: number;
  revenueCents: number;
};

export async function referralPerformance(since: Date): Promise<ReferralRow[]> {
  const rows = await db.execute<{
    id: string;
    name: string;
    code: string;
    active: boolean;
    visits: number;
    orders: number;
    revenue: number;
  }>(sql`
    select p.id, p.name, p.code, p.active,
      (select count(*)::int from partner_visits v where v.partner_id = p.id and v.at >= ${iso(since)}::timestamptz) as visits,
      (select count(*)::int from web_orders o where o.partner_id = p.id and o.created_at >= ${iso(since)}::timestamptz and o.status in ${sql.raw(PAID)}) as orders,
      (select coalesce(sum(total_cents), 0)::int from web_orders o where o.partner_id = p.id and o.created_at >= ${iso(since)}::timestamptz and o.status in ${sql.raw(PAID)}) as revenue
    from partners p
    order by revenue desc, visits desc, p.sort_order`);
  return [...rows].map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    active: r.active,
    visits: r.visits,
    orders: r.orders,
    revenueCents: r.revenue,
  }));
}

export const LEAD_STATUSES = ['new', 'contacted', 'quoted', 'booked', 'declined'] as const;

export async function cateringPipeline(): Promise<Record<(typeof LEAD_STATUSES)[number], number>> {
  const rows = await db.execute<{ status: (typeof LEAD_STATUSES)[number]; n: number }>(sql`
    select status, count(*)::int as n from catering_leads group by status`);
  const out = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<
    (typeof LEAD_STATUSES)[number],
    number
  >;
  for (const r of rows) out[r.status] = r.n;
  return out;
}

/** Start of the reporting window, `days` back from now. */
export function sinceDaysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}
