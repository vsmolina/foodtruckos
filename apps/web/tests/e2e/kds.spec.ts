import { test, expect, type APIRequestContext } from '@playwright/test';
import { createHmac, randomUUID } from 'node:crypto';

// A correctly-signed thin `order.created` webhook, exactly as Square sends one.
// The server (SQUARE_MOCK=1) hydrates it from a fixture: 2× Mexican Burger
// (note "no onions", +Extra cheese) and 1× Horchata. Returns the KDS card number
// the ticket will render as (`#` + last 4 of the order id, upper-cased).
async function fireOrder(request: APIRequestContext): Promise<string> {
  const port = process.env.KDS_TEST_PORT ?? '3100';
  const notificationUrl = `http://localhost:${port}/api/webhooks/square`;
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? 'devkey';

  const orderId = `E2E-${randomUUID().slice(0, 8).toUpperCase()}`;
  const thin = { order_id: orderId, location_id: 'E2E_LOC', version: 1, state: 'OPEN' };
  const envelope = {
    merchant_id: 'E2E_MERCHANT',
    type: 'order.created',
    event_id: randomUUID(),
    created_at: new Date().toISOString(),
    data: { type: 'order', id: orderId, object: { order_created: thin } },
  };
  const body = JSON.stringify(envelope);
  const signature = createHmac('sha256', signatureKey)
    .update(notificationUrl + body)
    .digest('base64');

  const res = await request.post(notificationUrl, {
    headers: {
      'content-type': 'application/json',
      'x-square-hmacsha256-signature': signature,
    },
    data: body,
  });
  expect(res.status(), 'webhook accepted').toBe(200);

  return `#${orderId.slice(-4).toUpperCase()}`;
}

// Wait until the board's socket has connected (and joined its store room) so a
// freshly-fired order is delivered live rather than missed.
async function waitForConnected(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.getByText('Waiting for the next order…')).toBeVisible();
  await page.waitForTimeout(500); // let the room join settle
}

test('an order appears on the board and can be completed', async ({ page, request }) => {
  await page.goto('/kds');
  await waitForConnected(page);

  const number = await fireOrder(request);
  const card = page.getByRole('button', { name: `Order ${number}, tap to complete` });
  await expect(card).toBeVisible();
  // Line items hydrated from the fixture rendered on the card.
  await expect(card.getByText('Mexican Burger')).toBeVisible();
  await expect(card.getByText('Horchata')).toBeVisible();

  // Tap → two-step confirm (guards against a fat-finger during a rush).
  await card.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /Done/ }).click();

  // Completing removes it from the board everywhere.
  await expect(card).toBeHidden();
});

test('a card turns amber after 3 minutes', async ({ page, request }) => {
  await page.clock.install();
  await page.goto('/kds');
  await waitForConnected(page);

  const number = await fireOrder(request);
  const card = page.getByRole('button', { name: `Order ${number}, tap to complete` });
  await expect(card).toBeVisible();

  // Fresh order: neutral tier — a 1px rule border.
  await expect(card).toHaveCSS('border-top-width', '1px');

  // Advance past the 3-minute amber threshold; the single board clock ticks
  // forward and the card recomputes its tier.
  await page.clock.fastForward('03:30');

  // Amber tier: a 2px border in the dark-theme --warn colour (#e0a15a).
  await expect(card).toHaveCSS('border-top-width', '2px');
  await expect(card).toHaveCSS('border-top-color', 'rgb(224, 161, 90)');
});
