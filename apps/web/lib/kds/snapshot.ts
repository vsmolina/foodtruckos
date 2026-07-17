import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  kitchenTickets,
  orderItemModifiers,
  orderItems,
  orders,
  stores,
} from '@/lib/db/schema';
import type { KdsTicket, KdsTicketItem } from './types';

function displayNumber(squareOrderId: string | null, fallbackId: string): string {
  const src = squareOrderId ?? fallbackId;
  return `#${src.slice(-4).toUpperCase()}`;
}

/**
 * All active kitchen tickets for a store, oldest first — replayed to a KDS
 * client on connect so a server restart never loses orders. "Active" =
 * pending or in_progress.
 */
export async function getActiveTickets(storeId: string): Promise<KdsTicket[]> {
  const rows = await db
    .select({
      ticketId: kitchenTickets.id,
      state: kitchenTickets.state,
      startedAt: kitchenTickets.startedAt,
      orderId: orders.id,
      squareOrderId: orders.squareOrderId,
      placedAt: orders.openedAt,
    })
    .from(kitchenTickets)
    .innerJoin(orders, eq(kitchenTickets.orderId, orders.id))
    .where(
      and(
        eq(orders.storeId, storeId),
        inArray(kitchenTickets.state, ['pending', 'in_progress']),
      ),
    )
    .orderBy(kitchenTickets.startedAt);

  if (rows.length === 0) return [];

  const orderIds = rows.map((r) => r.orderId);
  const items = await db
    .select()
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds));
  const itemIds = items.map((i) => i.id);
  const mods = itemIds.length
    ? await db
        .select()
        .from(orderItemModifiers)
        .where(inArray(orderItemModifiers.orderItemId, itemIds))
    : [];

  const modsByItem = new Map<string, string[]>();
  for (const m of mods) {
    const list = modsByItem.get(m.orderItemId) ?? [];
    list.push(m.nameSnapshot);
    modsByItem.set(m.orderItemId, list);
  }
  const itemsByOrder = new Map<string, KdsTicketItem[]>();
  for (const it of items) {
    const list = itemsByOrder.get(it.orderId) ?? [];
    list.push({
      qty: it.qty,
      name: it.nameSnapshot,
      notes: it.notes,
      modifiers: modsByItem.get(it.id) ?? [],
    });
    itemsByOrder.set(it.orderId, list);
  }

  return rows.map((r) => ({
    id: r.ticketId,
    orderId: r.orderId,
    number: displayNumber(r.squareOrderId, r.orderId),
    state: r.state,
    startedAt: r.startedAt.toISOString(),
    placedAt: r.placedAt.toISOString(),
    items: itemsByOrder.get(r.orderId) ?? [],
  }));
}

/** Resolve the default store id (single-store MVP) when the KDS gets no ?store=. */
export async function defaultStoreId(): Promise<string | null> {
  const row = await db.select({ id: stores.id }).from(stores).limit(1);
  return row[0]?.id ?? null;
}
