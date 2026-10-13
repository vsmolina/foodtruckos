import 'server-only';
import Stripe from 'stripe';

let cached: Stripe | null = null;

export function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  cached ??= new Stripe(key, { timeout: 8000, maxNetworkRetries: 1 });
  return cached;
}
