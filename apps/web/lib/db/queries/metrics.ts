import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { businesses } from '@/lib/db/schema';

// Typed metric queries for the owner dashboard. Money is integer cents; the DB
// stores UTC timestamptz, and "today" is the current calendar day in the
// business's timezone (businesses.timezone, default America/Chicago).

/** The single business's timezone (MVP is one business). */
export async function businessTimezone(): Promise<string> {
  const [row] = await db
    .select({ tz: businesses.timezone })
    .from(businesses)
    .limit(1);
  return row?.tz ?? 'America/Chicago';
}

// Start of "today" as a timestamptz, in the given timezone. Index-friendly:
// it's a single constant per query, so `opened_at >= <this>` uses the index.
const startOfTodayLocal = (tz: string) =>
  sql`(date_trunc('day', now() AT TIME ZONE ${tz}) AT TIME ZONE ${tz})`;

export type TodaySummary = {
  /** Kitchen tickets currently open (not done/cancelled) — "right now". */
  activeTickets: number;
  /** When the longest-waiting open ticket started (ISO), or null. */
  oldestActiveStartedAt: string | null;
  /** Sum of order totals opened today, excluding cancelled/refunded. */
  salesCents: number;
  /** Orders opened today, excluding cancelled/refunded. */
  orders: number;
  /** Average kitchen ticket duration for tickets completed today, in seconds. */
  avgTicketSeconds: number | null;
  /** The same three, for the same weekday last week up to this time of day —
   *  a like-for-like comparison ("by this time last Monday"). */
  lastWeek: { salesCents: number; orders: number; avgTicketSeconds: number | null };
};

export async function getTodaySummary(): Promise<TodaySummary> {
  const tz = await businessTimezone();
  const today = startOfTodayLocal(tz);
  const weekAgoStart = sql`(${today} - interval '7 days')`;
  const weekAgoNow = sql`(now() - interval '7 days')`;

  const [row] = await db.execute<{
    active_tickets: number;
    oldest_active: string | null;
    sales_cents: number;
    orders: number;
    avg_ticket_seconds: number | null;
    lw_sales_cents: number;
    lw_orders: number;
    lw_avg_ticket_seconds: number | null;
  }>(sql`
    select
      (select count(*) from kitchen_tickets
         where state not in ('done', 'cancelled'))::int as active_tickets,
      (select min(started_at) from kitchen_tickets
         where state not in ('done', 'cancelled')) as oldest_active,
      coalesce(sum(o.total_cents) filter (
        where o.opened_at >= ${today} and o.status not in ('cancelled', 'refunded')
      ), 0)::int as sales_cents,
      count(*) filter (
        where o.opened_at >= ${today} and o.status not in ('cancelled', 'refunded')
      )::int as orders,
      (select avg(extract(epoch from (completed_at - started_at)))
         from kitchen_tickets
         where completed_at is not null and completed_at >= ${today})::float
        as avg_ticket_seconds,
      coalesce(sum(o.total_cents) filter (
        where o.opened_at >= ${weekAgoStart} and o.opened_at < ${weekAgoNow}
          and o.status not in ('cancelled', 'refunded')
      ), 0)::int as lw_sales_cents,
      count(*) filter (
        where o.opened_at >= ${weekAgoStart} and o.opened_at < ${weekAgoNow}
          and o.status not in ('cancelled', 'refunded')
      )::int as lw_orders,
      (select avg(extract(epoch from (completed_at - started_at)))
         from kitchen_tickets
         where completed_at >= ${weekAgoStart} and completed_at < ${weekAgoNow})::float
        as lw_avg_ticket_seconds
    from orders o
    where o.opened_at >= ${weekAgoStart}
  `);

  return {
    activeTickets: row?.active_tickets ?? 0,
    oldestActiveStartedAt: row?.oldest_active ? new Date(row.oldest_active).toISOString() : null,
    salesCents: row?.sales_cents ?? 0,
    orders: row?.orders ?? 0,
    avgTicketSeconds: row?.avg_ticket_seconds ?? null,
    lastWeek: {
      salesCents: row?.lw_sales_cents ?? 0,
      orders: row?.lw_orders ?? 0,
      avgTicketSeconds: row?.lw_avg_ticket_seconds ?? null,
    },
  };
}

export type RecentOrder = {
  id: string;
  squareOrderId: string | null;
  status: string;
  totalCents: number;
  itemCount: number;
  /** "2× Mexican Burger, 1× Horchata" — what was ordered, at a glance. */
  itemSummary: string;
  /** Kitchen time (in → done) in seconds; null while still cooking. */
  ticketSeconds: number | null;
  /** Kitchen ticket state: pending / in_progress / done / cancelled, or null. */
  ticketState: string | null;
  openedAt: string;
};

/** The latest orders, newest first — for the Today page's activity list. */
export async function getRecentOrders(limit = 10): Promise<RecentOrder[]> {
  const rows = await db.execute<{
    id: string;
    square_order_id: string | null;
    status: string;
    total_cents: number;
    item_count: number;
    item_summary: string | null;
    ticket_seconds: number | null;
    ticket_state: string | null;
    opened_at: string;
  }>(sql`
    select
      o.id,
      o.square_order_id,
      o.status,
      o.total_cents,
      (select coalesce(sum(oi.qty), 0) from order_items oi where oi.order_id = o.id)::int as item_count,
      (select string_agg(oi.qty || '× ' || oi.name_snapshot, ', ' order by oi.id)
         from order_items oi where oi.order_id = o.id) as item_summary,
      extract(epoch from (kt.completed_at - kt.started_at))::float as ticket_seconds,
      kt.state as ticket_state,
      o.opened_at
    from orders o
    left join kitchen_tickets kt on kt.order_id = o.id
    order by o.opened_at desc
    limit ${limit}
  `);

  return rows.map((r) => ({
    id: r.id,
    squareOrderId: r.square_order_id,
    status: r.status,
    totalCents: r.total_cents,
    itemCount: r.item_count,
    itemSummary: r.item_summary ?? '',
    ticketSeconds: r.ticket_seconds,
    ticketState: r.ticket_state,
    openedAt: r.opened_at,
  }));
}
