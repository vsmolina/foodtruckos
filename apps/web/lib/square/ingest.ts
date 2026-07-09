import { eq, inArray } from 'drizzle-orm';
import type * as Square from 'square';
import { db } from '@/lib/db/client';
import {
  kitchenTickets,
  orderItemModifiers,
  orderItems,
  orders,
  payments,
  stores,
} from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { publish } from '@/lib/realtime/channel';
import { retrieveOrder } from './client';

/** BigInt cents → number cents. Square amounts are always minor units. */
function cents(m: Square.Money | null | undefined): number {
  return Number(m?.amount ?? 0n);
}

/** Deep-convert BigInt → string so the value is JSONB-serializable (raw_payload). */
function toJsonSafe(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

/** Map a Square order state to our order status enum. */
function mapStatus(state: Square.OrderState | undefined): 'open' | 'fulfilled' | 'cancelled' {
  switch (state) {
    case 'COMPLETED':
      return 'fulfilled';
    case 'CANCELED':
      return 'cancelled';
    default:
      return 'open';
  }
}

/**
 * Resolve our store id from Square's location id. Falls back to the single
 * store for the MVP (one truck) and logs when the location was unmatched.
 */
async function resolveStoreId(locationId: string | undefined): Promise<string | null> {
  if (locationId) {
    const matched = await db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.squareLocationId, locationId))
      .limit(1);
    if (matched[0]) return matched[0].id;
  }
  const all = await db.select({ id: stores.id }).from(stores).limit(2);
  if (all.length === 1 && all[0]) {
    logger.warn({ locationId }, 'square location unmatched; falling back to sole store');
    return all[0].id;
  }
  logger.error({ locationId }, 'could not resolve store for square location');
  return null;
}

/** Short display number for the KDS card, e.g. "#3407". */
function displayNumber(squareOrderId: string): string {
  return `#${squareOrderId.slice(-4).toUpperCase()}`;
}

type TicketEvent = {
  type: 'ticket:created' | 'ticket:updated' | 'ticket:removed';
  ticket: {
    id: string;
    orderId: string;
    number: string;
    state: string;
    startedAt: string;
    items: { qty: number; name: string; notes: string | null; modifiers: string[] }[];
  };
};

/**
 * Upsert a hydrated Square order into our tables and (re)create its kitchen
 * ticket. Idempotent and version-guarded: an event whose version is ≤ the
 * stored version is ignored. Publishes a KDS event to Redis on change.
 */
export async function upsertOrder(sqOrder: Square.Order): Promise<void> {
  const squareOrderId = sqOrder.id;
  if (!squareOrderId) throw new Error('hydrated order missing id');

  const storeId = await resolveStoreId(sqOrder.locationId);
  if (!storeId) throw new Error(`no store for location ${sqOrder.locationId}`);

  const incomingVersion = sqOrder.version ?? 0;
  const status = mapStatus(sqOrder.state);
  const taxCents = cents(sqOrder.totalTaxMoney);
  const tipCents = cents(sqOrder.totalTipMoney);
  const totalCents = cents(sqOrder.totalMoney);
  const subtotalCents = Math.max(0, totalCents - taxCents - tipCents);

  const event = await db.transaction(async (tx): Promise<TicketEvent | null> => {
    const existing = await tx
      .select()
      .from(orders)
      .where(eq(orders.squareOrderId, squareOrderId))
      .limit(1);
    const prior = existing[0];

    // Version guard: ignore stale/duplicate updates.
    if (prior && prior.squareVersion != null && incomingVersion <= prior.squareVersion) {
      logger.info({ squareOrderId, incomingVersion, stored: prior.squareVersion }, 'stale order event ignored');
      return null;
    }

    const orderValues = {
      storeId,
      squareOrderId,
      squareVersion: incomingVersion,
      status,
      subtotalCents,
      taxCents,
      tipCents,
      totalCents,
      rawPayload: toJsonSafe(sqOrder),
      closedAt: status === 'open' ? null : new Date(),
    };

    let orderRow;
    if (prior) {
      [orderRow] = await tx.update(orders).set(orderValues).where(eq(orders.id, prior.id)).returning();
    } else {
      [orderRow] = await tx.insert(orders).values(orderValues).returning();
    }
    if (!orderRow) throw new Error('failed to upsert order');

    // Replace line items wholesale — Square is source of truth.
    const oldItems = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderRow.id));
    if (oldItems.length) {
      await tx.delete(orderItemModifiers).where(
        inArray(orderItemModifiers.orderItemId, oldItems.map((i) => i.id)),
      );
      await tx.delete(orderItems).where(eq(orderItems.orderId, orderRow.id));
    }

    const items: TicketEvent['ticket']['items'] = [];
    for (const li of sqOrder.lineItems ?? []) {
      const qty = Number(li.quantity ?? '1');
      const unit = cents(li.basePriceMoney);
      const [itemRow] = await tx
        .insert(orderItems)
        .values({
          orderId: orderRow.id,
          menuItemId: null,
          nameSnapshot: li.name ?? 'Item',
          qty,
          unitPriceCents: unit,
          lineTotalCents: cents(li.grossSalesMoney) || unit * qty,
          notes: li.note ?? null,
        })
        .returning();
      if (!itemRow) throw new Error('failed to insert order item');

      const modifierNames: string[] = [];
      for (const m of li.modifiers ?? []) {
        const name = m.name ?? 'Modifier';
        modifierNames.push(name);
        await tx.insert(orderItemModifiers).values({
          orderItemId: itemRow.id,
          nameSnapshot: name,
          priceCentsDelta: cents(m.basePriceMoney),
        });
      }
      items.push({ qty, name: li.name ?? 'Item', notes: li.note ?? null, modifiers: modifierNames });
    }

    // Kitchen ticket: one per order (unique). Cancel it if the order cancelled.
    const existingTicket = await tx
      .select()
      .from(kitchenTickets)
      .where(eq(kitchenTickets.orderId, orderRow.id))
      .limit(1);
    let ticket = existingTicket[0];

    if (status === 'cancelled') {
      if (ticket) {
        [ticket] = await tx
          .update(kitchenTickets)
          .set({ state: 'cancelled', completedAt: new Date() })
          .where(eq(kitchenTickets.id, ticket.id))
          .returning();
      }
      if (!ticket) return null;
      return { type: 'ticket:removed', ticket: toTicketPayload(ticket, orderRow.id, squareOrderId, items) };
    }

    if (!ticket) {
      [ticket] = await tx.insert(kitchenTickets).values({ orderId: orderRow.id }).returning();
      if (!ticket) throw new Error('failed to create kitchen ticket');
      return { type: 'ticket:created', ticket: toTicketPayload(ticket, orderRow.id, squareOrderId, items) };
    }
    return { type: 'ticket:updated', ticket: toTicketPayload(ticket, orderRow.id, squareOrderId, items) };
  });

  if (event) {
    await publish(`kds:store:${storeId}`, event);
    logger.info({ squareOrderId, type: event.type }, 'kds event published');
  }
}

function toTicketPayload(
  ticket: typeof kitchenTickets.$inferSelect,
  orderId: string,
  squareOrderId: string,
  items: TicketEvent['ticket']['items'],
): TicketEvent['ticket'] {
  return {
    id: ticket.id,
    orderId,
    number: displayNumber(squareOrderId),
    state: ticket.state,
    startedAt: ticket.startedAt.toISOString(),
    items,
  };
}

/** Convenience: hydrate by id then upsert. Used by the webhook dispatcher. */
export async function ingestOrderById(orderId: string): Promise<void> {
  const sqOrder = await retrieveOrder(orderId);
  await upsertOrder(sqOrder);
}

/** Upsert a payment (read-only mirror in the MVP). */
export async function ingestPayment(payment: Square.Payment): Promise<void> {
  const squarePaymentId = payment.id;
  if (!squarePaymentId) return;

  let orderId: string | null = null;
  if (payment.orderId) {
    const matched = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.squareOrderId, payment.orderId))
      .limit(1);
    orderId = matched[0]?.id ?? null;
  }

  const values = {
    orderId,
    squarePaymentId,
    amountCents: cents(payment.amountMoney),
    tipCents: cents(payment.tipMoney),
    status: payment.status ?? 'UNKNOWN',
    cardBrand: payment.cardDetails?.card?.cardBrand ?? null,
    rawPayload: toJsonSafe(payment),
  };

  await db
    .insert(payments)
    .values(values)
    .onConflictDoUpdate({ target: payments.squarePaymentId, set: values });
}
