import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { businesses, orders } from '@/lib/db/schema';

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
  /** Sum of order totals opened today, excluding cancelled/refunded. */
  salesCents: number;
  /** Orders marked fulfilled today. */
  ordersClosed: number;
  /** Average kitchen ticket duration for tickets completed today, in seconds. */
  avgTicketSeconds: number | null;
};

export async function getTodaySummary(): Promise<TodaySummary> {
  const tz = await businessTimezone();
  const today = startOfTodayLocal(tz);

  const [row] = await db.execute<{
    active_tickets: number;
    sales_cents: number;
    orders_closed: number;
    avg_ticket_seconds: number | null;
  }>(sql`
    select
      (select count(*) from kitchen_tickets
         where state not in ('done', 'cancelled'))::int as active_tickets,
      coalesce(sum(o.total_cents) filter (
        where o.opened_at >= ${today} and o.status not in ('cancelled', 'refunded')
      ), 0)::int as sales_cents,
      count(*) filter (
        where o.status = 'fulfilled' and o.closed_at >= ${today}
      )::int as orders_closed,
      (select avg(extract(epoch from (completed_at - started_at)))
         from kitchen_tickets
         where completed_at is not null and completed_at >= ${today})::float
        as avg_ticket_seconds
    from orders o
  `);

  return {
    activeTickets: row?.active_tickets ?? 0,
    salesCents: row?.sales_cents ?? 0,
    ordersClosed: row?.orders_closed ?? 0,
    avgTicketSeconds: row?.avg_ticket_seconds ?? null,
  };
}

export type RecentOrder = {
  id: string;
  squareOrderId: string | null;
  status: string;
  totalCents: number;
  itemCount: number;
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
    opened_at: string;
  }>(sql`
    select
      o.id,
      o.square_order_id,
      o.status,
      o.total_cents,
      (select count(*) from order_items oi where oi.order_id = o.id)::int as item_count,
      o.opened_at
    from orders o
    order by o.opened_at desc
    limit ${limit}
  `);

  return rows.map((r) => ({
    id: r.id,
    squareOrderId: r.square_order_id,
    status: r.status,
    totalCents: r.total_cents,
    itemCount: r.item_count,
    openedAt: r.opened_at,
  }));
}
