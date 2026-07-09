import type * as Square from 'square';

/**
 * Build a plausible hydrated Square order for offline E2E (SQUARE_MOCK=1).
 * Deterministic from the given ids so tests can assert on the result. Money is
 * BigInt cents, matching the real SDK.
 */
export function makeMockOrder(orderId: string, locationId: string): Square.Order {
  const lineItems: Square.OrderLineItem[] = [
    {
      uid: 'li-1',
      name: 'Mexican Burger',
      variationName: 'Large',
      quantity: '2',
      basePriceMoney: { amount: 1399n, currency: 'USD' },
      grossSalesMoney: { amount: 2798n, currency: 'USD' },
      totalMoney: { amount: 2798n, currency: 'USD' },
      note: 'no onions',
      modifiers: [{ uid: 'm-1', name: 'Extra cheese', basePriceMoney: { amount: 100n, currency: 'USD' } }],
    },
    {
      uid: 'li-2',
      name: 'Horchata',
      quantity: '1',
      basePriceMoney: { amount: 349n, currency: 'USD' },
      grossSalesMoney: { amount: 349n, currency: 'USD' },
      totalMoney: { amount: 349n, currency: 'USD' },
    },
  ];
  return {
    id: orderId,
    locationId,
    state: 'OPEN',
    version: 1,
    lineItems,
    totalTaxMoney: { amount: 260n, currency: 'USD' },
    totalTipMoney: { amount: 0n, currency: 'USD' },
    totalMoney: { amount: 3407n, currency: 'USD' },
    createdAt: '2026-07-09T19:00:00Z',
  };
}
