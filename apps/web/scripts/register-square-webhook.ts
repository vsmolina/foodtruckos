import { randomUUID } from 'node:crypto';
import { squareClient } from '@/lib/square/client';

/**
 * Create a Square webhook subscription programmatically (alternative to the
 * Developer Dashboard). Prints the subscription id and its Signature Key —
 * copy the key into SQUARE_WEBHOOK_SIGNATURE_KEY.
 *
 *   SQUARE_WEBHOOK_NOTIFICATION_URL=https://api.yourdomain.com/api/webhooks/square \
 *   pnpm --filter web exec tsx scripts/register-square-webhook.ts
 *
 * Needs SQUARE_ACCESS_TOKEN, SQUARE_ENVIRONMENT, SQUARE_WEBHOOK_NOTIFICATION_URL.
 */
const EVENT_TYPES = [
  'order.created',
  'order.updated',
  'order.fulfillment.updated',
  'payment.created',
  'payment.updated',
];

async function main(): Promise<void> {
  const notificationUrl = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL;
  if (!notificationUrl || notificationUrl.includes('yourdomain.com')) {
    throw new Error('Set SQUARE_WEBHOOK_NOTIFICATION_URL to your real public webhook URL first');
  }
  const apiVersion = process.env.SQUARE_API_VERSION ?? '2025-01-23';

  const res = await squareClient().webhooks.subscriptions.create({
    idempotencyKey: randomUUID(),
    subscription: {
      name: 'foodtruck-os',
      eventTypes: EVENT_TYPES,
      notificationUrl,
      apiVersion,
      enabled: true,
    },
  });

  const sub = res.subscription;
  console.info(`Created subscription: ${sub?.id}`);
  console.info(`Notification URL:     ${sub?.notificationUrl}`);
  console.info(`API version:          ${sub?.apiVersion}`);
  console.info(`\nSignature Key (put in SQUARE_WEBHOOK_SIGNATURE_KEY):\n${sub?.signatureKey ?? '(not returned — read it from the Dashboard)'}`);
}

main().catch((err) => {
  console.error('[register-square-webhook] failed:', err);
  process.exit(1);
});
