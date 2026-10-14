import { randomUUID } from 'node:crypto';
import { squareClient } from '@/lib/square/client';

/**
 * Simulate a lunch rush in the Square **sandbox**: ring up random itemized orders
 * at random intervals (with the odd burst) until stopped or the time is up, so
 * the KDS can be exercised like a real service. Ctrl+C to stop.
 *
 *   pnpm --filter web square:sandbox-rush [minutes=30] [minGapSec=15] [maxGapSec=60]
 */
const MENU: Array<{ name: string; cents: bigint }> = [
  { name: 'Bacon Cheeseburger', cents: 1199n },
  { name: 'Green Chile Burger', cents: 1149n },
  { name: 'Mexican Burger', cents: 1099n },
  { name: 'Chili Cheese Dog', cents: 849n },
  { name: 'Sonoran Dog', cents: 799n },
  { name: 'Elote (Street Corn)', cents: 449n },
  { name: 'Loaded Fries', cents: 599n },
  { name: 'Horchata', cents: 349n },
  { name: 'Mexican Coke', cents: 299n },
];

// Special instructions, as cooks see them from the POS. Ad-hoc $0 modifiers and
// line-item notes, so the KDS shows NO / ADD / EXTRA tags, notes and allergies.
const MODS = ['No Ketchup', 'No Pickled Jalapeños', 'Add Mustard', 'Extra Cheese', 'No Onions', 'Add Bacon', 'Grilled Onions'];
const NOTES = ['cut in half', 'well done please', 'sauce on the side', 'PEANUT ALLERGY', 'gluten allergy - no bun'];

const rand = (min: number, max: number): number => min + Math.floor(Math.random() * (max - min + 1));
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function ringUp(locationId: string): Promise<void> {
  const picks = [...MENU].sort(() => Math.random() - 0.5).slice(0, rand(1, 4));
  const lineItems = picks.map((m) => ({
    name: m.name,
    quantity: String(rand(1, 3)),
    basePriceMoney: { amount: m.cents, currency: 'USD' as const },
    ...(Math.random() < 0.45
      ? {
          modifiers: [...MODS]
            .sort(() => Math.random() - 0.5)
            .slice(0, rand(1, 3))
            .map((name) => ({ name, basePriceMoney: { amount: 0n, currency: 'USD' as const } })),
        }
      : {}),
    ...(Math.random() < 0.12 ? { note: NOTES[rand(0, NOTES.length - 1)] } : {}),
  }));
  const client = squareClient();
  const { order } = await client.orders.create({
    idempotencyKey: randomUUID(),
    order: { locationId, lineItems },
  });
  if (!order?.id) throw new Error('order create returned no id');
  const total = order.totalMoney?.amount ?? 0n;
  await client.payments.create({
    idempotencyKey: randomUUID(),
    sourceId: 'cnon:card-nonce-ok', // Square sandbox test card
    amountMoney: { amount: total, currency: 'USD' },
    orderId: order.id,
    locationId,
  });
  const summary = lineItems.map((l) => `${l.quantity}× ${l.name}`).join(', ');
  console.info(`${new Date().toLocaleTimeString()}  #${order.id.slice(-4)}  $${(Number(total) / 100).toFixed(2)}  ${summary}`);
}

async function main(): Promise<void> {
  if (process.env.SQUARE_ENVIRONMENT !== 'sandbox') throw new Error('refusing to run outside the Square sandbox');
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) throw new Error('SQUARE_LOCATION_ID is required');
  const [minutes = 30, minGap = 15, maxGap = 60] = process.argv.slice(2).map(Number);
  const until = Date.now() + minutes * 60_000;
  console.info(`Rush for ${minutes} min, an order every ${minGap}–${maxGap}s. Ctrl+C to stop.`);

  while (Date.now() < until) {
    const burst = Math.random() < 0.2 ? rand(2, 3) : 1;
    for (let i = 0; i < burst; i++) {
      try {
        await ringUp(locationId);
      } catch (err) {
        console.error('[sandbox-rush] order failed:', err instanceof Error ? err.message : err);
      }
    }
    await sleep(rand(minGap, maxGap) * 1000);
  }
  console.info('Rush over.');
}

main().catch((err) => {
  console.error('[sandbox-rush] failed:', err);
  process.exit(1);
});
