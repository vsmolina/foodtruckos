import { createHmac, randomUUID } from 'node:crypto';

/**
 * Offline E2E driver: POST a correctly-signed thin `order.created` event to the
 * local webhook endpoint. The server (run with SQUARE_MOCK=1) stubs the Square
 * hydration from a fixture, so this needs no network and no real Square app.
 *
 * Usage:
 *   SQUARE_MOCK=1 SQUARE_WEBHOOK_SIGNATURE_KEY=devkey \
 *   SQUARE_WEBHOOK_NOTIFICATION_URL=http://localhost:3001/api/webhooks/square \
 *   pnpm --filter web exec tsx scripts/mock-square.ts
 *
 * Env:
 *   MOCK_TARGET_URL  where to POST (defaults to the notification URL)
 *   MOCK_EVENT_TYPE  order.created (default) | order.updated
 */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required (see scripts/mock-square.ts header)`);
  return v;
}

async function main(): Promise<void> {
  const signatureKey = requireEnv('SQUARE_WEBHOOK_SIGNATURE_KEY');
  const notificationUrl = requireEnv('SQUARE_WEBHOOK_NOTIFICATION_URL');
  const targetUrl = process.env.MOCK_TARGET_URL ?? notificationUrl;
  const eventType = process.env.MOCK_EVENT_TYPE ?? 'order.created';

  const orderId = `MOCK-${randomUUID().slice(0, 8).toUpperCase()}`;
  const locationId = process.env.SQUARE_LOCATION_ID ?? 'MOCK_LOCATION';
  const thin = { order_id: orderId, location_id: locationId, version: 1, state: 'OPEN' };
  const key = eventType === 'order.updated' ? 'order_updated' : 'order_created';

  const envelope = {
    merchant_id: 'MOCK_MERCHANT',
    type: eventType,
    event_id: randomUUID(),
    created_at: new Date().toISOString(),
    data: { type: 'order', id: orderId, object: { [key]: thin } },
  };

  const body = JSON.stringify(envelope);
  // Square's scheme: HMAC-SHA256 over notificationUrl + body, base64.
  const signature = createHmac('sha256', signatureKey).update(notificationUrl + body).digest('base64');

  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-square-hmacsha256-signature': signature },
    body,
  });

  const text = await res.text();
  console.info(`[mock-square] ${eventType} order=${orderId} -> ${res.status} ${text}`);
  if (!res.ok) process.exit(1);
}

main().catch((err) => {
  console.error('[mock-square] failed:', err);
  process.exit(1);
});
