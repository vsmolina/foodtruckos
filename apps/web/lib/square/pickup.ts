import { eq } from 'drizzle-orm';
import type * as Square from 'square';
import { db } from '@/lib/db/client';
import { kitchenTickets, orders } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { squareClient } from './client';

// Website pickup orders: move the order's PICKUP fulfillment as the kitchen
// works, so the customer's status page (and text) follow the KDS:
//   ticket on the board → RESERVED ("Preparing"), tapped done → PREPARED
//   ("Ready"), recalled → RESERVED. POS orders have no PICKUP fulfillment and
// are skipped. Best effort: errors are logged and swallowed — the kitchen
// never waits on Square.

type PickupState = 'RESERVED' | 'PREPARED';
const OPTS = { timeoutInSeconds: 5 } as const;

export async function setPickupState(
  squareOrderId: string,
  state: PickupState,
  opts: { onlyFrom?: Square.FulfillmentState[] } = {},
): Promise<void> {
  if (process.env.SQUARE_MOCK === '1' || !process.env.SQUARE_ACCESS_TOKEN) return;
  try {
    const { order } = await squareClient().orders.get({ orderId: squareOrderId }, OPTS);
    const f = order?.fulfillments?.find((x) => x.type === 'PICKUP');
    if (!order || !f?.uid || f.state === state) return;
    if (opts.onlyFrom && (!f.state || !opts.onlyFrom.includes(f.state))) return;
    if (f.state === 'COMPLETED' || f.state === 'CANCELED' || f.state === 'FAILED') return;
    await squareClient().orders.update(
      {
        orderId: squareOrderId,
        order: { locationId: order.locationId, version: order.version ?? 0, fulfillments: [{ uid: f.uid, state }] },
        idempotencyKey: `pickup-${squareOrderId}-${order.version ?? 0}-${state}`,
      },
      OPTS,
    );
    logger.info({ squareOrderId, state }, 'pickup fulfillment updated');
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err), squareOrderId, state }, 'pickup fulfillment update failed');
  }
}

/** Same, starting from a kitchen ticket id (KDS socket handlers). */
export async function setPickupStateForTicket(ticketId: string, state: PickupState): Promise<void> {
  try {
    const [row] = await db
      .select({ squareOrderId: orders.squareOrderId })
      .from(kitchenTickets)
      .innerJoin(orders, eq(orders.id, kitchenTickets.orderId))
      .where(eq(kitchenTickets.id, ticketId));
    if (row?.squareOrderId) await setPickupState(row.squareOrderId, state);
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err), ticketId }, 'pickup lookup failed');
  }
}

/**
 * A website order that hasn't been paid yet shouldn't reach the kitchen. A
 * declined card still adds a tender (cardDetails.status FAILED), so "has a
 * tender" isn't enough: require a captured/authorized one.
 */
export function isUnpaidWebOrder(order: Square.Order): boolean {
  if (order.source?.name !== 'Barrio website') return false;
  const paid = (order.tenders ?? []).some(
    (t) => t.type !== 'CARD' || t.cardDetails?.status === 'CAPTURED' || t.cardDetails?.status === 'AUTHORIZED',
  );
  return !paid;
}
