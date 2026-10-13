import 'server-only';
import type { MerchOrderLine, merchOrders } from '@/lib/db/schema';

// Fulfillment layer. Each product says how it ships (merch_products.fulfillment):
//   'self' — the owner packs and ships (or hands it over at the truck) and marks
//            the order fulfilled in /admin/merch.
//   'pod'  — a print-on-demand provider makes and ships it. NOT INTEGRATED: the
//            owner wants to choose a provider first. A real provider needs:
//            • an API key (e.g. PRINTFUL_API_KEY / PRINTIFY_API_TOKEN) in env;
//            • product/variant mapping — the provider's ids go in
//              merch_products.provider_ref and merch_variants.provider_ref;
//            • submit(): create the provider order with the shipping address and
//              mapped variants, return its id;
//            • a provider webhook (shipped / tracking) → set tracking_number and
//              fulfilled_at, send the shipped email;
//            • costs: provider base price + their shipping, so check margins.

export type MerchOrder = typeof merchOrders.$inferSelect;

export interface FulfillmentProvider {
  id: 'self' | 'pod';
  label: string;
  submit(order: MerchOrder, lines: MerchOrderLine[]): Promise<{ externalId?: string }>;
}

export class NotConfiguredError extends Error {
  constructor(message = 'Print-on-demand provider is not configured') {
    super(message);
    this.name = 'NotConfiguredError';
  }
}

const self: FulfillmentProvider = {
  id: 'self',
  label: 'We ship it',
  async submit() {
    return {}; // Owner packs it; nothing to send anywhere.
  },
};

const pod: FulfillmentProvider = {
  id: 'pod',
  label: 'Print on demand (not set up)',
  async submit() {
    throw new NotConfiguredError();
  },
};

export function providerFor(fulfillment: string): FulfillmentProvider {
  return fulfillment === 'pod' ? pod : self;
}
