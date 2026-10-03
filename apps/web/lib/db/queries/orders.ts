import { sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { orderStatus } from '@/lib/db/schema';
import { businessTimezone } from './metrics';

// Order history for the dashboard's /orders page. Dates are calendar days in the
// business's timezone; `to` is inclusive. Money stays integer cents.

export const ORDER_STATUSES = orderStatus.enumValues;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderFilters = {
  /** YYYY-MM-DD, inclusive, business-local. */
  from?: string | undefined;
  /** YYYY-MM-DD, inclusive, business-local. */
  to?: string | undefined;
  status?: OrderStatus | undefined;
  /** Order number fragment, with or without a leading "#". */
  q?: string | undefined;
  /** 1-based. */
  page: number;
  pageSize: number;
};

export type OrderListRow = {
  id: string;
  squareOrderId: string | null;
  status: OrderStatus;
  totalCents: number;
  itemCount: number;
  openedAt: string;
};

export type OrderPage = {
  rows: OrderListRow[];
  total: number;
  page: number;
  pageCount: number;
};

// Escape LIKE wildcards so a typed "%" or "_" matches literally.
const likeEscape = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listOrders(filters: OrderFilters): Promise<OrderPage> {
  const tz = await businessTimezone();

  const conds: SQL[] = [];
  if (filters.from) {
    conds.push(sql`o.opened_at >= ((${filters.from}::date)::timestamp AT TIME ZONE ${tz})`);
  }
  if (filters.to) {
    conds.push(sql`o.opened_at < ((${filters.to}::date + 1)::timestamp AT TIME ZONE ${tz})`);
  }
  if (filters.status) {
    conds.push(sql`o.status = ${filters.status}`);
  }
  const q = filters.q?.trim().replace(/^#/, '');
  if (q) {
    // Order numbers are the tail of the Square id (or our uuid when there's none).
    conds.push(sql`coalesce(o.square_order_id, o.id::text) ilike ${`%${likeEscape(q)}%`}`);
  }
  const where = conds.length ? sql`where ${sql.join(conds, sql` and `)}` : sql``;

  const [countRow] = await db.execute<{ total: number }>(
    sql`select count(*)::int as total from orders o ${where}`,
  );
  const total = countRow?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
  const page = Math.min(Math.max(1, filters.page), pageCount);

  const rows = await db.execute<{
    id: string;
    square_order_id: string | null;
    status: OrderStatus;
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
    ${where}
    order by o.opened_at desc, o.id desc
    limit ${filters.pageSize} offset ${(page - 1) * filters.pageSize}
  `);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      squareOrderId: r.square_order_id,
      status: r.status,
      totalCents: r.total_cents,
      itemCount: r.item_count,
      openedAt: r.opened_at,
    })),
    total,
    page,
    pageCount,
  };
}
