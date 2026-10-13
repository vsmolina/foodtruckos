import 'server-only';
import type * as Square from 'square';
import { has, paymentsMock } from '@/lib/env';
import { SQ, squareClient, squareLocationId } from '@/lib/square/client';
import { squareReady, type PricedLine } from './pricing';

// Square side of a web order. Square computes tax from the location's tax
// settings, so the truck's tax setup is the only one that matters.

export const MOCK_TAX_RATE = 0.0825; // San Marcos, TX combined rate — mock mode only

/** Use Square for this cart? (configured, not mocked, and every line has catalog ids) */
export function viaSquare(lines: PricedLine[]): boolean {
  return has.square && !paymentsMock() && squareReady(lines);
}

function lineItems(lines: PricedLine[]): Square.OrderLineItem[] {
  return lines.map((l) => ({
    quantity: String(l.qty),
    catalogObjectId: l.variationSquareId!,
    modifiers: l.modifierSquareIds.map((id) => ({ catalogObjectId: id! })),
    ...(l.note ? { note: l.note } : {}),
  }));
}

const cents = (m: Square.Money | undefined): number => Number(m?.amount ?? 0);

/** Tax and total before tip, as Square will charge them. */
export async function quoteWithSquare(lines: PricedLine[]): Promise<{ subtotalCents: number; taxCents: number; totalCents: number }> {
  const res = await squareClient().orders.calculate(
    { order: { locationId: squareLocationId(), lineItems: lineItems(lines) } },
    SQ,
  );
  const o = res.order;
  if (!o) throw new Error('Square returned no order for calculate');
  const tax = cents(o.totalTaxMoney);
  const total = cents(o.totalMoney);
  return { subtotalCents: total - tax, taxCents: tax, totalCents: total };
}

export function quoteMock(subtotalCents: number): { subtotalCents: number; taxCents: number; totalCents: number } {
  const taxCents = Math.round(subtotalCents * MOCK_TAX_RATE);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

/** Create the Square order (PICKUP, PROPOSED) for a web order. */
export async function createSquareOrder(opts: {
  webOrderId: string;
  code: string;
  lines: PricedLine[];
  name: string;
  phone: string;
  pickupAt: Date;
}): Promise<Square.Order> {
  const res = await squareClient().orders.create(
    {
      idempotencyKey: `web-order-${opts.webOrderId}`,
      order: {
        locationId: squareLocationId(),
        referenceId: opts.code,
        source: { name: 'Barrio website' },
        lineItems: lineItems(opts.lines),
        fulfillments: [
          {
            type: 'PICKUP',
            state: 'PROPOSED',
            pickupDetails: {
              recipient: { displayName: opts.name, phoneNumber: opts.phone },
              scheduleType: 'ASAP',
              pickupAt: opts.pickupAt.toISOString(),
              note: `Web order ${opts.code}`,
            },
          },
        ],
      },
    },
    SQ,
  );
  if (!res.order?.id) throw new Error('Square returned no order');
  return res.order;
}

/** Charge the card for the Square order total plus tip. */
export async function paySquareOrder(opts: {
  webOrderId: string;
  order: Square.Order;
  sourceId: string;
  tipCents: number;
  phone: string;
  verificationToken?: string | undefined;
}): Promise<Square.Payment> {
  const res = await squareClient().payments.create(
    {
      idempotencyKey: `web-pay-${opts.webOrderId}`,
      sourceId: opts.sourceId,
      ...(opts.verificationToken ? { verificationToken: opts.verificationToken } : {}),
      amountMoney: { amount: opts.order.totalMoney?.amount ?? 0n, currency: 'USD' },
      ...(opts.tipCents > 0 ? { tipMoney: { amount: BigInt(opts.tipCents), currency: 'USD' } } : {}),
      orderId: opts.order.id!,
      locationId: squareLocationId(),
      autocomplete: true,
      buyerPhoneNumber: opts.phone,
      ...(opts.order.referenceId ? { referenceId: opts.order.referenceId } : {}),
      note: 'Barrio website pickup',
    },
    SQ,
  );
  if (!res.payment?.id) throw new Error('Square returned no payment');
  return res.payment;
}

/** Friendly text for a Square payment error. */
export function paymentErrorMessage(err: unknown): string {
  const errors = (err as { errors?: Array<{ code?: string; detail?: string }> })?.errors;
  const code = errors?.[0]?.code ?? '';
  if (/CVV|VERIFY_CVV/.test(code)) return 'The security code didn’t match. Check it and try again.';
  if (/ADDRESS|POSTAL/.test(code)) return 'The ZIP code didn’t match the card. Check it and try again.';
  if (/EXPIRATION|EXPIRED/.test(code)) return 'That card is expired. Try another one.';
  if (/INSUFFICIENT|DECLINED|GENERIC_DECLINE|CARD_DECLINED/.test(code)) return 'Your card was declined. Try another card.';
  return 'We couldn’t take the payment. Nothing was charged — try again, or order at the window.';
}

/**
 * Cancel an unpaid Square order (after a declined card) so it never reaches the
 * kitchen. Square requires its fulfillments to be cancelled too, and the
 * version moves when a declined tender is added, so re-read it first.
 */
export async function cancelSquareOrder(orderId: string, idempotencyKey: string): Promise<void> {
  const latest = (await squareClient().orders.get({ orderId }, SQ)).order;
  if (!latest || latest.state === 'CANCELED' || latest.state === 'COMPLETED') return;
  await squareClient().orders.update(
    {
      orderId,
      order: {
        locationId: squareLocationId(),
        version: latest.version ?? 1,
        state: 'CANCELED',
        fulfillments: (latest.fulfillments ?? []).filter((f) => f.uid).map((f) => ({ uid: f.uid!, state: 'CANCELED' as const })),
      },
      idempotencyKey,
    },
    SQ,
  );
}
