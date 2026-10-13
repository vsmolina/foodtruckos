import { z } from 'zod';

// What the browser sends: ids and quantities only. Names and prices are
// always re-read on the server (lib/orders/pricing.ts).

export const NOTE_MAX = 140;
export const QTY_MAX = 20;

export const cartLineSchema = z.object({
  variationId: z.uuid(),
  modifierIds: z.array(z.uuid()).max(20),
  qty: z.number().int().min(1).max(QTY_MAX),
  note: z.string().trim().max(NOTE_MAX).optional(),
});
export const cartSchema = z.array(cartLineSchema).min(1, 'Your bag is empty.').max(30);

export type CartLine = z.infer<typeof cartLineSchema>;

export const TIP_OPTIONS = [0, 10, 15, 20] as const;
export type TipPercent = (typeof TIP_OPTIONS)[number];

/** Shown next to the SMS checkbox at checkout and stored with the order. */
export const SMS_CONSENT_TEXT =
  'Text me when my order is ready. One message per order. Msg & data rates may apply. Reply STOP to opt out.';
