import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { webOrders } from '@/lib/db/schema';
import { has } from '@/lib/env';
import { sendSms } from '@/lib/messaging/sms';
import { SQ, squareClient } from '@/lib/square/client';

// Web order status comes from the Square PICKUP fulfillment, which the truck's
// foodtruck-os moves as the kitchen works: ticket on the KDS → RESERVED,
// tapped done → PREPARED. See PLAN.md → Integration.

export type WebOrderStatus = (typeof webOrders.$inferSelect)['status'];
type WebOrder = typeof webOrders.$inferSelect;

const FROM_SQUARE: Record<string, WebOrderStatus> = {
  PROPOSED: 'received',
  RESERVED: 'preparing',
  PREPARED: 'ready',
  COMPLETED: 'picked_up',
  CANCELED: 'cancelled',
  FAILED: 'cancelled',
};
const RANK: Partial<Record<WebOrderStatus, number>> = { received: 1, preparing: 2, ready: 3, picked_up: 4 };

/** Would moving from `cur` to `next` be a legitimate kitchen transition? */
function accepts(cur: WebOrderStatus, next: WebOrderStatus): boolean {
  if (cur === next) return false;
  if (cur === 'pending_payment' || cur === 'failed' || cur === 'cancelled' || cur === 'picked_up') return false;
  if (next === 'cancelled') return true;
  if (cur === 'ready' && next === 'preparing') return true; // recalled on the KDS
  return (RANK[next] ?? 0) > (RANK[cur] ?? 0);
}

/** Pull the latest fulfillment state from Square and persist it. Returns the fresh row. */
export async function syncOrderStatus(webOrderId: string): Promise<WebOrder | null> {
  const [order] = await db.select().from(webOrders).where(eq(webOrders.id, webOrderId));
  if (!order) return null;
  if (!order.squareOrderId || !has.square) return order;
  if (order.status === 'picked_up' || order.status === 'cancelled' || order.status === 'failed') return order;
  try {
    const res = await squareClient().orders.get({ orderId: order.squareOrderId }, SQ);
    const f = res.order?.fulfillments?.find((x) => x.type === 'PICKUP');
    const next = f?.state ? FROM_SQUARE[f.state] : undefined;
    if (next && accepts(order.status, next)) return await setOrderStatus(order.id, next);
  } catch (err) {
    console.error('[orders] sync failed:', err instanceof Error ? err.message : err);
  }
  return order;
}

export async function syncBySquareOrderId(squareOrderId: string): Promise<void> {
  const [order] = await db.select({ id: webOrders.id }).from(webOrders).where(eq(webOrders.squareOrderId, squareOrderId));
  if (order) await syncOrderStatus(order.id);
}

/** Set a status (Square sync or the admin) and send the ready text once. */
export async function setOrderStatus(webOrderId: string, status: WebOrderStatus): Promise<WebOrder | null> {
  const [row] = await db
    .update(webOrders)
    .set({ status, ...(status === 'ready' ? { readyAt: new Date() } : {}) })
    .where(eq(webOrders.id, webOrderId))
    .returning();
  if (row && status === 'ready') await sendReadyText(row);
  return row ?? null;
}

/** Text "ready" exactly once per order (atomic claim on ready_sms_sent_at). */
async function sendReadyText(order: WebOrder): Promise<void> {
  if (!order.smsOptIn) return;
  const [claimed] = await db
    .update(webOrders)
    .set({ readySmsSentAt: new Date() })
    .where(and(eq(webOrders.id, order.id), isNull(webOrders.readySmsSentAt)))
    .returning({ id: webOrders.id });
  if (!claimed) return;
  await sendSms(order.phone, `Barrio Burger: order ${order.code} is READY at the window. ¡Buen provecho! Reply STOP to opt out.`);
}
