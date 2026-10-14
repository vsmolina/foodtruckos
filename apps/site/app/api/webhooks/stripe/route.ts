import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { applyPaidSession, cancelExpiredSession } from '@/lib/merch/stripe-session';
import { stripeClient } from '@/lib/stripe';

// Stripe → merch orders. Register in the Stripe Dashboard (Developers →
// Webhooks) for: checkout.session.completed, checkout.session.async_payment_succeeded,
// checkout.session.expired. Signing secret → STRIPE_WEBHOOK_SECRET.

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get('stripe-signature');
  if (!secret || !signature) return NextResponse.json({ error: 'not configured' }, { status: 400 });

  const raw = await req.text(); // raw body — required for signature verification
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    console.warn('[stripe] bad signature:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'bad signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await applyPaidSession(event.data.object);
        break;
      case 'checkout.session.expired':
        await cancelExpiredSession(event.data.object);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error('[stripe] handler failed:', err);
    return NextResponse.json({ error: 'handler failed' }, { status: 500 }); // Stripe retries
  }
  return NextResponse.json({ received: true });
}
