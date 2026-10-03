import { asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  kitchenTickets,
  orderItemModifiers,
  orderItems,
  orderStatus,
  orders,
  payments,
  stores,
} from '@/lib/db/schema';
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OrderDetail = {
  order: typeof orders.$inferSelect & { storeName: string };
  items: (typeof orderItems.$inferSelect & {
    modifiers: (typeof orderItemModifiers.$inferSelect)[];
  })[];
  payments: (typeof payments.$inferSelect)[];
  ticket: typeof kitchenTickets.$inferSelect | null;
};

/** Everything about one order, for /orders/[id]. null if the id is unknown or malformed. */
export async function getOrderDetail(id: string): Promise<OrderDetail | null> {
  // Postgres rejects a non-uuid literal with an error; treat it as not found.
  if (!UUID_RE.test(id)) return null;

  const [row] = await db
    .select({ order: orders, storeName: stores.name })
    .from(orders)
    .innerJoin(stores, eq(stores.id, orders.storeId))
    .where(eq(orders.id, id))
    .limit(1);
  if (!row) return null;

  const [items, pays, tickets] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.id)),
    db.select().from(payments).where(eq(payments.orderId, id)).orderBy(asc(payments.createdAt)),
    db.select().from(kitchenTickets).where(eq(kitchenTickets.orderId, id)).limit(1),
  ]);

  const mods = items.length
    ? await db
        .select()
        .from(orderItemModifiers)
        .where(inArray(orderItemModifiers.orderItemId, items.map((i) => i.id)))
        .orderBy(asc(orderItemModifiers.id))
    : [];

  return {
    order: { ...row.order, storeName: row.storeName },
    items: items.map((i) => ({ ...i, modifiers: mods.filter((m) => m.orderItemId === i.id) })),
    payments: pays,
    ticket: tickets[0] ?? null,
  };
}
