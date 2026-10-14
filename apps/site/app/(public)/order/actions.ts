'use server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { webOrders } from '@/lib/db/schema';
import { paymentsMock } from '@/lib/env';
import { toE164 } from '@/lib/format';
import { cartSchema, SMS_CONSENT_TEXT, TIP_OPTIONS, type CartLine } from '@/lib/orders/cart';
import { orderCode, orderToken } from '@/lib/orders/codes';
import { CartError, priceCart, snapshot } from '@/lib/orders/pricing';
import {
  cancelSquareOrder,
  createSquareOrder,
  paySquareOrder,
  paymentErrorMessage,
  quoteMock,
  quoteWithSquare,
  viaSquare,
} from '@/lib/orders/square';
import { rateLimit } from '@/lib/rate-limit';
import { referralPartnerId } from '@/lib/referral';
import { orderingState } from '@/lib/status';

export type Quote =
  | {
      ok: true;
      lines: Array<{ name: string; detail: string; qty: number; lineCents: number }>;
      subtotalCents: number;
      taxCents: number;
      tipCents: number;
      totalCents: number;
      paymentMode: 'square' | 'mock';
      waitMinutes: number;
    }
  | { ok: false; error: string };

const tipSchema = z.union(TIP_OPTIONS.map((n) => z.literal(n)) as unknown as [z.ZodLiteral<0>, z.ZodLiteral<10>, z.ZodLiteral<15>, z.ZodLiteral<20>]);

const tipFor = (subtotalCents: number, pct: number) => Math.round((subtotalCents * pct) / 100);

/** Server-priced summary for the checkout page (tax from Square when live). */
export async function quoteCart(lines: CartLine[], tipPercent: number): Promise<Quote> {
  const parsedLines = cartSchema.safeParse(lines);
  const parsedTip = tipSchema.safeParse(tipPercent);
  if (!parsedLines.success || !parsedTip.success) return { ok: false, error: 'Your bag looks off. Remove items and try again.' };
  const state = await orderingState();
  if (!state.canOrder) return { ok: false, error: closedMessage(state.reason) };
  try {
    const priced = await priceCart(parsedLines.data);
    const square = viaSquare(priced.lines);
    const q = square ? await quoteWithSquare(priced.lines) : quoteMock(priced.subtotalCents);
    const tipCents = tipFor(q.subtotalCents, parsedTip.data);
    return {
      ok: true,
      lines: priced.lines.map((l) => ({
        name: l.itemName,
        detail: [l.variationName !== 'Regular' ? l.variationName : null, ...l.modifiers.map((m) => m.name), l.note ? `“${l.note}”` : null]
          .filter(Boolean)
          .join(' · '),
        qty: l.qty,
        lineCents: l.unitCents * l.qty,
      })),
      subtotalCents: q.subtotalCents,
      taxCents: q.taxCents,
      tipCents,
      totalCents: q.totalCents + tipCents,
      paymentMode: square ? 'square' : 'mock',
      waitMinutes: state.waitMinutes,
    };
  } catch (err) {
    if (err instanceof CartError) return { ok: false, error: err.message };
    console.error('[order] quote failed:', err);
    return { ok: false, error: 'We couldn’t price your order right now. Try again in a moment.' };
  }
}

const placeSchema = z.object({
  lines: cartSchema,
  name: z.string().trim().min(1, 'Add a name we can call out.').max(40, 'Keep the name under 40 characters.'),
  phone: z.string().trim().min(1, 'Add a mobile number.'),
  smsOptIn: z.boolean(),
  tipPercent: tipSchema,
  sourceId: z.string().max(500).optional(),
  verificationToken: z.string().max(2000).optional(),
});

export type PlaceResult =
  | { ok: true; token: string }
  | { ok: false; error: string; fieldErrors?: Partial<Record<'name' | 'phone', string>> };

export async function placeOrder(input: z.input<typeof placeSchema>): Promise<PlaceResult> {
  if (!(await rateLimit('place-order', 8, 10 * 60))) return { ok: false, error: 'Too many tries. Wait a few minutes or order at the window.' };

  const parsed = placeSchema.safeParse(input);
  if (!parsed.success) {
    const fe = z.flattenError(parsed.error).fieldErrors;
    return {
      ok: false,
      error: 'Check the highlighted fields.',
      fieldErrors: { ...(fe.name?.[0] ? { name: fe.name[0] } : {}), ...(fe.phone?.[0] ? { phone: fe.phone[0] } : {}) },
    };
  }
  const data = parsed.data;
  const phone = toE164(data.phone);
  if (!phone) return { ok: false, error: 'Check the highlighted fields.', fieldErrors: { phone: 'Enter a 10-digit US mobile number.' } };

  const state = await orderingState();
  if (!state.canOrder) return { ok: false, error: closedMessage(state.reason) };

  let priced;
  try {
    priced = await priceCart(data.lines);
  } catch (err) {
    if (err instanceof CartError) return { ok: false, error: err.message };
    throw err;
  }
  const square = viaSquare(priced.lines);
  if (square && !data.sourceId) return { ok: false, error: 'Enter your card details to pay.' };
  if (!square && !paymentsMock()) return { ok: false, error: 'Online ordering isn’t available right now. Order at the window.' };

  const pre = quoteMock(priced.subtotalCents);
  const tipCents = tipFor(priced.subtotalCents, data.tipPercent);
  const pickupAt = new Date(Date.now() + state.waitMinutes * 60_000);

  // Create the web order first so every Square call has a stable idempotency key.
  let order: typeof webOrders.$inferSelect | undefined;
  for (let attempt = 0; attempt < 5 && !order; attempt++) {
    const [row] = await db
      .insert(webOrders)
      .values({
        code: orderCode(),
        token: orderToken(),
        customerName: data.name,
        phone,
        smsOptIn: data.smsOptIn,
        smsConsentText: data.smsOptIn ? SMS_CONSENT_TEXT : null,
        lines: snapshot(priced.lines),
        subtotalCents: priced.subtotalCents,
        taxCents: pre.taxCents,
        tipCents,
        totalCents: pre.totalCents + tipCents,
        partnerId: await referralPartnerId(),
        estimatedReadyAt: pickupAt,
      })
      .onConflictDoNothing()
      .returning();
    order = row;
  }
  if (!order) return { ok: false, error: 'Something went wrong. Try again.' };

  if (!square) {
    // Mock mode (development only): accept without charging.
    await db.update(webOrders).set({ status: 'received', paidAt: new Date() }).where(eq(webOrders.id, order.id));
    return { ok: true, token: order.token };
  }

  let sqOrder;
  try {
    sqOrder = await createSquareOrder({ webOrderId: order.id, code: order.code, lines: priced.lines, name: data.name, phone, pickupAt });
  } catch (err) {
    console.error('[order] square order failed:', err);
    await db.update(webOrders).set({ status: 'failed', error: 'square order create failed' }).where(eq(webOrders.id, order.id));
    return { ok: false, error: 'We couldn’t send your order to the truck. Nothing was charged — try again, or order at the window.' };
  }
  const taxCents = Number(sqOrder.totalTaxMoney?.amount ?? 0);
  const orderTotal = Number(sqOrder.totalMoney?.amount ?? 0);
  await db
    .update(webOrders)
    .set({ squareOrderId: sqOrder.id!, subtotalCents: orderTotal - taxCents, taxCents, totalCents: orderTotal + tipCents })
    .where(eq(webOrders.id, order.id));

  try {
    const payment = await paySquareOrder({
      webOrderId: order.id,
      order: sqOrder,
      sourceId: data.sourceId!,
      verificationToken: data.verificationToken,
      tipCents,
      phone,
    });
    await db
      .update(webOrders)
      .set({ status: 'received', paidAt: new Date(), squarePaymentId: payment.id! })
      .where(eq(webOrders.id, order.id));
  } catch (err) {
    console.error('[order] payment failed:', err);
    await db.update(webOrders).set({ status: 'failed', error: 'payment declined or failed' }).where(eq(webOrders.id, order.id));
    // Cancel the unpaid Square order so it never reaches the kitchen.
    try {
      await cancelSquareOrder(sqOrder.id!, `web-cancel-${order.id}`);
    } catch (cancelErr) {
      console.error('[order] cancel after failed payment failed:', cancelErr);
    }
    return { ok: false, error: paymentErrorMessage(err) };
  }

  return { ok: true, token: order.token };
}

function closedMessage(reason: 'closed' | 'back_soon' | 'paused'): string {
  if (reason === 'paused') return 'Online orders are paused for a few minutes — come to the window!';
  if (reason === 'back_soon') return 'We’re not on the Square right now, so online ordering is off.';
  return 'We’re closed right now, so online ordering is off.';
}
