import 'server-only';
import { and, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { merchOrders, merchProducts, merchVariants, type MerchOrderLine } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { money } from '@/lib/format';
import { ownerContacts, sendEmail } from '@/lib/messaging/email';
import { providerFor } from './fulfillment';

export type PaidDetails = {
  email?: string | null;
  name?: string | null;
  shippingAddress?: unknown;
  shippingCents?: number;
  taxCents?: number;
  totalCents?: number;
  paymentIntentId?: string | null;
};

function linesText(lines: MerchOrderLine[]): string {
  return lines
    .map(
      (l) =>
        `${l.qty} × ${l.productName}${l.variantLabel ? ` (${l.variantLabel})` : ''} — ${money(l.unitCents * l.qty)}`,
    )
    .join('\n');
}

/**
 * Mark a merch order paid. Idempotent: only the first call (status pending →
 * paid) decrements stock, hands off to fulfillment and sends emails.
 */
export async function markMerchOrderPaid(orderId: string, d: PaidDetails): Promise<boolean> {
  const [order] = await db
    .update(merchOrders)
    .set({
      status: 'paid',
      ...(d.email !== undefined ? { email: d.email } : {}),
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.shippingAddress !== undefined ? { shippingAddress: d.shippingAddress } : {}),
      ...(d.shippingCents !== undefined ? { shippingCents: d.shippingCents } : {}),
      ...(d.taxCents !== undefined ? { taxCents: d.taxCents } : {}),
      ...(d.totalCents !== undefined ? { totalCents: d.totalCents } : {}),
      ...(d.paymentIntentId !== undefined ? { stripePaymentIntentId: d.paymentIntentId } : {}),
    })
    .where(and(eq(merchOrders.id, orderId), eq(merchOrders.status, 'pending')))
    .returning();
  if (!order) return false; // already handled (webhook retry) or not pending

  // Stock: decrement only where there is enough; anything else is an oversell
  // (two buyers raced for the last one) — floor at 0 and flag it in the log.
  for (const line of order.lines) {
    const ok = await db
      .update(merchVariants)
      .set({ stock: sql`${merchVariants.stock} - ${line.qty}` })
      .where(
        and(
          eq(merchVariants.id, line.variantId),
          isNotNull(merchVariants.stock),
          gte(merchVariants.stock, line.qty),
        ),
      )
      .returning({ id: merchVariants.id });
    if (ok.length === 0) {
      const [v] = await db
        .select({ stock: merchVariants.stock })
        .from(merchVariants)
        .where(eq(merchVariants.id, line.variantId));
      if (v && v.stock !== null) {
        console.error(
          `[merch] OVERSELL order ${order.id}: ${line.productName} ${line.variantLabel} wanted ${line.qty}, had ${v.stock}`,
        );
        await db
          .update(merchVariants)
          .set({ stock: 0 })
          .where(eq(merchVariants.id, line.variantId));
      }
    }
  }

  // Print-on-demand items go to the provider (not set up yet → logged, manual).
  const variantRows = await db
    .select({ id: merchVariants.id, fulfillment: merchProducts.fulfillment })
    .from(merchVariants)
    .innerJoin(merchProducts, eq(merchProducts.id, merchVariants.productId))
    .where(
      inArray(
        merchVariants.id,
        order.lines.map((l) => l.variantId),
      ),
    );
  const podLines = order.lines.filter(
    (l) => variantRows.find((v) => v.id === l.variantId)?.fulfillment === 'pod',
  );
  if (podLines.length) {
    try {
      await providerFor('pod').submit(order, podLines);
    } catch (err) {
      console.warn(
        `[merch] order ${order.id}: print-on-demand hand-off failed, fulfill manually —`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const ref = order.id.slice(-6).toUpperCase();
  const body = `${linesText(order.lines)}\n\nShipping: ${money(order.shippingCents)}\nTax: ${money(order.taxCents)}\nTotal: ${money(order.totalCents)}`;
  if (order.email) {
    await sendEmail({
      to: order.email,
      subject: `¡Gracias! Your Barrio merch order #${ref}`,
      text:
        `Thanks${order.name ? `, ${order.name.split(' ')[0]}` : ''}! We got your order.\n\n${body}\n\n` +
        (order.delivery === 'pickup'
          ? 'Pick it up at the truck window — just give your name. We’ll hold it for 30 days.'
          : 'We’ll email you a tracking number when it ships.') +
        `\n\nQuestions? Reply to this email.\n${env.siteUrl}/merch`,
    });
  }
  const owner = ownerContacts();
  if (owner.email) {
    await sendEmail({
      to: owner.email,
      subject: `New merch order #${ref} — ${money(order.totalCents)} (${order.delivery})`,
      text: `${order.name ?? ''} ${order.email ?? ''}\n\n${body}\n\n${env.siteUrl}/admin/merch/orders/${order.id}`,
    });
  }
  return true;
}
