import 'server-only';
import type Stripe from 'stripe';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { merchOrders } from '@/lib/db/schema';
import { markMerchOrderPaid } from './orders';

/** Apply a completed, paid Checkout Session to its merch order (idempotent). */
export async function applyPaidSession(session: Stripe.Checkout.Session): Promise<void> {
  const orderId = session.metadata?.merch_order_id;
  if (!orderId || session.payment_status !== 'paid') return;
  const shipping = session.collected_information?.shipping_details ?? null;
  await markMerchOrderPaid(orderId, {
    email: session.customer_details?.email ?? null,
    name: shipping?.name ?? session.customer_details?.name ?? null,
    shippingAddress: shipping ? { name: shipping.name, ...shipping.address } : null,
    shippingCents: session.shipping_cost?.amount_total ?? 0,
    taxCents: session.total_details?.amount_tax ?? 0,
    totalCents: session.amount_total ?? 0,
    paymentIntentId:
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent?.id ?? null),
  });
}

export async function cancelExpiredSession(session: Stripe.Checkout.Session): Promise<void> {
  const orderId = session.metadata?.merch_order_id;
  if (!orderId) return;
  await db
    .update(merchOrders)
    .set({ status: 'cancelled' })
    .where(and(eq(merchOrders.id, orderId), eq(merchOrders.status, 'pending')));
}
