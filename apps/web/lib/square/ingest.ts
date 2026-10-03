import { eq, inArray, sql } from 'drizzle-orm';
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
import type { KdsTicket } from '@/lib/kds/types';
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

type TicketEvent = { type: 'ticket:created' | 'ticket:updated' | 'ticket:removed'; ticket: KdsTicket };

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
    // Square fires order.created and order.updated near-simultaneously. Serialize
    // per order so the second event sees the first's row (and the version guard)
    // instead of racing it into a unique-violation on square_order_id.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${squareOrderId}))`);

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
      return { type: 'ticket:removed', ticket: toTicketPayload(ticket, orderRow, items) };
    }

    if (!ticket) {
      [ticket] = await tx.insert(kitchenTickets).values({ orderId: orderRow.id }).returning();
      if (!ticket) throw new Error('failed to create kitchen ticket');
      return { type: 'ticket:created', ticket: toTicketPayload(ticket, orderRow, items) };
    }
    return { type: 'ticket:updated', ticket: toTicketPayload(ticket, orderRow, items) };
  });

  if (event) {
    await publish(`kds:store:${storeId}`, event);
    logger.info({ squareOrderId, type: event.type }, 'kds event published');
  }
}

function toTicketPayload(
  ticket: typeof kitchenTickets.$inferSelect,
  order: typeof orders.$inferSelect,
  items: KdsTicket['items'],
): KdsTicket {
  return {
    id: ticket.id,
    orderId: order.id,
    number: displayNumber(order.squareOrderId ?? order.id),
    state: ticket.state,
    startedAt: ticket.startedAt.toISOString(),
    placedAt: order.openedAt.toISOString(),
    items,
  };
}

/** Convenience: hydrate by id then upsert. Used by the webhook dispatcher. */
export async function ingestOrderById(orderId: string): Promise<void> {
  const sqOrder = await retrieveOrder(orderId);
  await upsertOrder(sqOrder);
}

// payment.* webhooks carry the FULL payment object, but as raw snake_case JSON
// (not the SDK's camelCase shape). Model only the fields we persist.
type RawMoney = { amount?: number | null; currency?: string | null };
export type RawPayment = {
  id?: string;
  order_id?: string | null;
  amount_money?: RawMoney | null;
  tip_money?: RawMoney | null;
  status?: string | null;
  version?: number | null;
  card_details?: { card?: { card_brand?: string | null } | null } | null;
};

/** Upsert a payment (read-only mirror in the MVP). */
export async function ingestPayment(payment: RawPayment): Promise<void> {
  const squarePaymentId = payment.id;
  if (!squarePaymentId) return;

  let orderId: string | null = null;
  if (payment.order_id) {
    const matched = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.squareOrderId, payment.order_id))
      .limit(1);
    orderId = matched[0]?.id ?? null;
  }

  const values = {
    orderId,
    squarePaymentId,
    amountCents: Number(payment.amount_money?.amount ?? 0),
    tipCents: Number(payment.tip_money?.amount ?? 0),
    status: payment.status ?? 'UNKNOWN',
    cardBrand: payment.card_details?.card?.card_brand ?? null,
    rawPayload: toJsonSafe(payment),
  };

  // Square doesn't deliver webhooks in order: payment.created (v1, APPROVED) can
  // land after payment.updated (v2+, COMPLETED). Only overwrite with a newer
  // version; the stored version lives in raw_payload.
  const version = payment.version;
  await db
    .insert(payments)
    .values(values)
    .onConflictDoUpdate({
      target: payments.squarePaymentId,
      set: values,
      ...(version != null && {
        setWhere: sql`coalesce((${payments.rawPayload}->>'version')::int, -1) < ${version}`,
      }),
    });
}
