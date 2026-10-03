import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { businessTimezone } from './metrics';

// Report queries for /reports. All day/hour bucketing happens in the business's
// timezone; sales exclude cancelled/refunded orders. Money is integer cents.

const localNow = (tz: string) => sql`(now() AT TIME ZONE ${tz})`;
/** Local midnight `days` days before today, as a timestamptz (index-friendly). */
const localDayStart = (tz: string, daysAgo: number) =>
  sql`((date_trunc('day', ${localNow(tz)}) - make_interval(days => ${daysAgo})) AT TIME ZONE ${tz})`;

export type SalesHour = {
  hour: number;
  /** null for hours that haven't happened yet today. */
  todayCents: number | null;
  /** Mean of the previous 7 full days at this hour (closed days count as 0). */
  avgCents: number;
};

/** Sales per local hour: today vs the 7 days before it. Trimmed to hours with sales. */
export async function getSalesByHour(): Promise<SalesHour[]> {
  const tz = await businessTimezone();
  const rows = await db.execute<{ hour: number; today_cents: number; avg_cents: number; current_hour: number }>(sql`
    with o as (
      select
        date_trunc('day', opened_at AT TIME ZONE ${tz}) as day,
        extract(hour from opened_at AT TIME ZONE ${tz})::int as hour,
        total_cents
      from orders
      where status not in ('cancelled', 'refunded')
        and opened_at >= ${localDayStart(tz, 7)}
    )
    select
      h.hour,
      coalesce(sum(o.total_cents) filter (where o.day = date_trunc('day', ${localNow(tz)})), 0)::int as today_cents,
      (coalesce(sum(o.total_cents) filter (where o.day < date_trunc('day', ${localNow(tz)})), 0) / 7.0)::float as avg_cents,
      extract(hour from ${localNow(tz)})::int as current_hour
    from generate_series(0, 23) as h(hour)
    left join o on o.hour = h.hour
    group by h.hour
    order by h.hour
  `);

  const currentHour = rows[0]?.current_hour ?? 23;
  const active = rows.filter((r) => r.today_cents > 0 || r.avg_cents > 0).map((r) => r.hour);
  if (active.length === 0) return [];
  const first = Math.min(...active);
  const last = Math.max(...active);

  return rows
    .filter((r) => r.hour >= first && r.hour <= last)
    .map((r) => ({
      hour: r.hour,
      todayCents: r.hour <= currentHour ? r.today_cents : null,
      avgCents: Math.round(r.avg_cents),
    }));
}

export type TopItem = { name: string; qty: number };

/** Top 10 items by quantity sold over the last 7 days (today included). */
export async function getTopItems(): Promise<TopItem[]> {
  const tz = await businessTimezone();
  const rows = await db.execute<{ name: string; qty: number }>(sql`
    select oi.name_snapshot as name, sum(oi.qty)::int as qty
    from order_items oi
    join orders o on o.id = oi.order_id
    where o.status not in ('cancelled', 'refunded')
      and o.opened_at >= ${localDayStart(tz, 6)}
    group by oi.name_snapshot
    order by qty desc, name
    limit 10
  `);
  return rows.map((r) => ({ name: r.name, qty: r.qty }));
}

export type TicketTimeDay = {
  /** YYYY-MM-DD, business-local. */
  day: string;
  /** Mean seconds from ticket start to done; null when no tickets finished that day. */
  avgSeconds: number | null;
};

/** Average kitchen ticket time per local day, last 30 days (today included). */
export async function getTicketTimeTrend(): Promise<TicketTimeDay[]> {
  const tz = await businessTimezone();
  const rows = await db.execute<{ day: string; avg_seconds: number | null }>(sql`
    with t as (
      select
        date_trunc('day', completed_at AT TIME ZONE ${tz}) as day,
        avg(extract(epoch from (completed_at - started_at))) as avg_seconds
      from kitchen_tickets
      where state = 'done'
        and completed_at >= ${localDayStart(tz, 29)}
      group by 1
    )
    select to_char(d.day, 'YYYY-MM-DD') as day, t.avg_seconds::float as avg_seconds
    from generate_series(
      date_trunc('day', ${localNow(tz)}) - interval '29 days',
      date_trunc('day', ${localNow(tz)}),
      interval '1 day'
    ) as d(day)
    left join t on t.day = d.day
    order by d.day
  `);
  return rows.map((r) => ({ day: r.day, avgSeconds: r.avg_seconds }));
}
