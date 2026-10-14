import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { ClearCart } from '@/components/merch/ClearCart';
import { LinkButton } from '@/components/ui/Button';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { db } from '@/lib/db/client';
import { merchOrders } from '@/lib/db/schema';
import { has } from '@/lib/env';
import { money } from '@/lib/format';
import { applyPaidSession } from '@/lib/merch/stripe-session';
import { stripeClient } from '@/lib/stripe';

export const metadata: Metadata = { title: 'Order confirmed', robots: { index: false } };

type Props = { searchParams: Promise<{ session_id?: string }> };

export default async function MerchSuccessPage({ searchParams }: Props) {
  const sessionId = (await searchParams).session_id;
  let order = sessionId
    ? (
        await db
          .select()
          .from(merchOrders)
          .where(eq(merchOrders.stripeSessionId, sessionId))
          .limit(1)
      )[0]
    : undefined;

  // The webhook may not have landed yet: confirm with Stripe directly.
  if (order?.status === 'pending' && has.stripe && sessionId && !sessionId.startsWith('mock_')) {
    try {
      await applyPaidSession(await stripeClient().checkout.sessions.retrieve(sessionId));
      order = (await db.select().from(merchOrders).where(eq(merchOrders.id, order.id)).limit(1))[0];
    } catch (err) {
      console.warn(
        '[merch] success: could not confirm session',
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10">
        <SectionHeading as="h1" size="h1">
          Hmm, no order here
        </SectionHeading>
        <p className="mt-6 text-lg">
          We couldn’t find that order. If you were charged, check your email for the receipt or ask
          us at the truck.
        </p>
        <LinkButton href="/merch" className="mt-6">
          Back to merch
        </LinkButton>
      </div>
    );
  }

  const paid = order.status === 'paid' || order.status === 'fulfilled';
  const ref = order.id.slice(-6).toUpperCase();
  return (
    <div className="mx-auto max-w-2xl px-4 pt-10">
      {paid ? <ClearCart /> : null}
      <SectionHeading
        as="h1"
        size="h1"
        kicker={paid ? '¡Gracias, compa!' : 'Casi…'}
        underline="agave"
      >
        {paid ? 'Order confirmed' : 'Payment processing'}
      </SectionHeading>
      <div className="paper tilt-c mt-8 flex flex-col gap-4 p-5">
        <p className="font-display text-lg uppercase">Order #{ref}</p>
        <ul className="flex flex-col gap-1">
          {order.lines.map((l) => (
            <li key={l.variantId} className="flex justify-between gap-4">
              <span>
                {l.qty} × {l.productName}
                {l.variantLabel ? (
                  <span className="text-ink-muted"> ({l.variantLabel})</span>
                ) : null}
              </span>
              <span className="tabular-nums">{money(l.unitCents * l.qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 border-t-2 border-outline pt-2">
          <dt>Shipping</dt>
          <dd className="text-right tabular-nums">
            {order.shippingCents ? money(order.shippingCents) : 'Free'}
          </dd>
          <dt>Tax</dt>
          <dd className="text-right tabular-nums">{money(order.taxCents)}</dd>
          <dt className="font-bold">Total</dt>
          <dd className="text-right font-bold tabular-nums">{money(order.totalCents)}</dd>
        </dl>
        <p>
          {order.delivery === 'pickup'
            ? 'Pick it up at the truck window — just give your name. We’ll hold it for 30 days.'
            : 'We’ll email you a tracking number when it ships.'}
          {order.email ? ` A receipt is on its way to ${order.email}.` : ''}
        </p>
        {!paid ? (
          <p className="font-bold">Your payment is still processing. Refresh in a minute.</p>
        ) : null}
      </div>
      <LinkButton href="/" variant="paper" className="mt-8">
        Back home
      </LinkButton>
    </div>
  );
}
