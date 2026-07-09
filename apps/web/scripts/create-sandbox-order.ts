import { randomUUID } from 'node:crypto';
import { squareClient } from '@/lib/square/client';

/**
 * Ring up a real order in the Square **sandbox**: create an itemized order, then
 * pay it with the sandbox test card nonce. This fires genuine `order.created`,
 * `payment.created`, and `order.updated` webhooks to the configured subscription.
 *
 *   SQUARE_ACCESS_TOKEN=... SQUARE_ENVIRONMENT=sandbox SQUARE_LOCATION_ID=... \
 *   pnpm --filter web exec tsx scripts/create-sandbox-order.ts
 */
async function main(): Promise<void> {
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) throw new Error('SQUARE_LOCATION_ID is required');
  const client = squareClient();

  const orderRes = await client.orders.create({
    idempotencyKey: randomUUID(),
    order: {
      locationId,
      lineItems: [
        { name: 'Mexican Burger', quantity: '2', basePriceMoney: { amount: 1099n, currency: 'USD' } },
        { name: 'Horchata', quantity: '1', basePriceMoney: { amount: 349n, currency: 'USD' } },
      ],
    },
  });
  const order = orderRes.order;
  if (!order?.id) throw new Error('order create returned no id');
  const total = order.totalMoney?.amount ?? 0n;
  console.info(`created order ${order.id} total=${total} state=${order.state}`);

  const payRes = await client.payments.create({
    idempotencyKey: randomUUID(),
    sourceId: 'cnon:card-nonce-ok', // Square sandbox test card
    amountMoney: { amount: total, currency: 'USD' },
    orderId: order.id,
    locationId,
  });
  console.info(`payment ${payRes.payment?.id} status=${payRes.payment?.status}`);
  console.info('Webhooks (order.created/payment.created/order.updated) should now hit the subscription.');
}

main().catch((err) => {
  console.error('[create-sandbox-order] failed:', err);
  process.exit(1);
});
