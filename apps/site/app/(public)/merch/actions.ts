'use server';

import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { merchOrders, merchProducts, merchVariants, type MerchOrderLine } from '@/lib/db/schema';
import { env, has } from '@/lib/env';
import {
  inStock,
  shippingCents,
  taxCodeFor,
  variantLabel,
  variantPrice,
} from '@/lib/merch/catalog';
import { markMerchOrderPaid } from '@/lib/merch/orders';
import { rateLimit } from '@/lib/rate-limit';
import { stripeClient } from '@/lib/stripe';

const Lines = z
  .array(z.object({ variantId: z.uuid(), qty: z.int().min(1).max(10) }))
  .min(1)
  .max(20);

export type QuotedLine = {
  variantId: string;
  slug: string;
  productName: string;
  variantLabel: string;
  unitCents: number;
  qty: number;
  available: number | null; // null = unlimited
  problem: string | null;
};

/** Current prices and stock for the cart (the browser copy is display-only). */
async function quote(lines: Array<{ variantId: string; qty: number }>): Promise<QuotedLine[]> {
  const rows = await db
    .select({ v: merchVariants, p: merchProducts })
    .from(merchVariants)
    .innerJoin(merchProducts, eq(merchProducts.id, merchVariants.productId))
    .where(
      inArray(
        merchVariants.id,
        lines.map((l) => l.variantId),
      ),
    );
  return lines.map((l) => {
    const row = rows.find((r) => r.v.id === l.variantId);
    if (!row || !row.p.active) {
      return {
        variantId: l.variantId,
        slug: '',
        productName: 'Item no longer available',
        variantLabel: '',
        unitCents: 0,
        qty: l.qty,
        available: 0,
        problem: 'No longer available — remove it to check out.',
      };
    }
    const { v, p } = row;
    let problem: string | null = null;
    if (!inStock(v)) problem = 'Sold out — remove it to check out.';
    else if (v.stock !== null && v.stock < l.qty)
      problem = `Only ${v.stock} left — lower the quantity.`;
    return {
      variantId: v.id,
      slug: p.slug,
      productName: p.name,
      variantLabel: variantLabel(v),
      unitCents: variantPrice(p, v),
      qty: l.qty,
      available: v.stock,
      problem,
    };
  });
}

export async function quoteMerchCart(input: unknown): Promise<QuotedLine[] | { error: string }> {
  const parsed = Lines.safeParse(input);
  if (!parsed.success) return { error: 'Your cart looks out of date. Please refresh.' };
  return quote(parsed.data);
}

const Checkout = z.object({ lines: Lines, delivery: z.enum(['ship', 'pickup']) });

export type CheckoutResult = { url: string } | { error: string };

/**
 * Re-price from the DB, check stock, record a pending order, then hand off to
 * Stripe Checkout (Stripe Tax computes Texas / destination sales tax). Without
 * Stripe keys in development the order is marked paid directly (mock).
 */
export async function createMerchCheckout(input: unknown): Promise<CheckoutResult> {
  if (!(await rateLimit('merch-checkout', 10, 10 * 60)))
    return { error: 'Too many tries. Give it a few minutes.' };
  const parsed = Checkout.safeParse(input);
  if (!parsed.success) return { error: 'Your cart looks out of date. Please refresh.' };
  const { delivery } = parsed.data;

  const quoted = await quote(parsed.data.lines);
  const bad = quoted.find((q) => q.problem);
  if (bad)
    return {
      error: `${bad.productName}${bad.variantLabel ? ` (${bad.variantLabel})` : ''}: ${bad.problem}`,
    };

  const lines: MerchOrderLine[] = quoted.map((q) => ({
    variantId: q.variantId,
    productName: q.productName,
    variantLabel: q.variantLabel,
    qty: q.qty,
    unitCents: q.unitCents,
  }));
  const subtotal = lines.reduce((n, l) => n + l.unitCents * l.qty, 0);
  const ship = delivery === 'ship' ? shippingCents() : 0;

  const [order] = await db
    .insert(merchOrders)
    .values({
      lines,
      delivery,
      subtotalCents: subtotal,
      shippingCents: ship,
      totalCents: subtotal + ship,
    })
    .returning({ id: merchOrders.id });
  if (!order) return { error: 'Couldn’t start checkout. Try again.' };

  if (!has.stripe) {
    if (env.isProd) return { error: 'Online merch checkout isn’t set up yet. Ask at the truck!' };
    // Dev mock: no card, no tax — mark paid so the rest of the flow can be tested.
    const sessionId = `mock_${order.id}`;
    await db
      .update(merchOrders)
      .set({ stripeSessionId: sessionId })
      .where(eq(merchOrders.id, order.id));
    await markMerchOrderPaid(order.id, {
      name: 'Mock Customer',
      email: null,
      totalCents: subtotal + ship,
    });
    return { url: `/merch/success?session_id=${sessionId}` };
  }

  const products = await db
    .select({ id: merchVariants.id, slug: merchProducts.slug, name: merchProducts.name })
    .from(merchVariants)
    .innerJoin(merchProducts, eq(merchProducts.id, merchVariants.productId))
    .where(
      inArray(
        merchVariants.id,
        lines.map((l) => l.variantId),
      ),
    );

  try {
    const session = await stripeClient().checkout.sessions.create({
      mode: 'payment',
      line_items: lines.map((l) => {
        const p = products.find((x) => x.id === l.variantId)!;
        return {
          quantity: l.qty,
          price_data: {
            currency: 'usd',
            unit_amount: l.unitCents,
            tax_behavior: 'exclusive',
            product_data: {
              name: l.variantLabel ? `${l.productName} — ${l.variantLabel}` : l.productName,
              tax_code: taxCodeFor(p),
              metadata: { variant_id: l.variantId },
            },
          },
        };
      }),
      automatic_tax: { enabled: true },
      ...(delivery === 'ship'
        ? {
            shipping_address_collection: { allowed_countries: ['US'] },
            shipping_options: [
              {
                shipping_rate_data: {
                  type: 'fixed_amount',
                  display_name: 'Standard shipping (USPS)',
                  fixed_amount: { amount: ship, currency: 'usd' },
                  tax_behavior: 'exclusive',
                  delivery_estimate: {
                    minimum: { unit: 'business_day', value: 3 },
                    maximum: { unit: 'business_day', value: 8 },
                  },
                },
              },
            ],
          }
        : // Pickup: tax is computed from the billing address.
          { billing_address_collection: 'required' as const }),
      customer_creation: 'if_required',
      phone_number_collection: { enabled: false },
      metadata: { merch_order_id: order.id, delivery },
      payment_intent_data: { metadata: { merch_order_id: order.id } },
      success_url: `${env.siteUrl}/merch/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.siteUrl}/merch/cart`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    });
    await db
      .update(merchOrders)
      .set({ stripeSessionId: session.id })
      .where(eq(merchOrders.id, order.id));
    if (!session.url) throw new Error('Stripe returned no checkout URL');
    return { url: session.url };
  } catch (err) {
    console.error('[merch] checkout failed:', err instanceof Error ? err.message : err);
    await db.update(merchOrders).set({ status: 'cancelled' }).where(eq(merchOrders.id, order.id));
    return { error: 'Couldn’t reach the payment page. Try again in a minute.' };
  }
}
