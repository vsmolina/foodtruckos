import type { Empty, ImageUrl, IsoDate } from './common';

export type MerchFulfillment = 'self' | 'pod';
export type MerchOrderStatus = 'pending' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded';

export type MerchVariantDto = {
  id: string;
  size: string | null;
  color: string | null;
  /** "M / Black"; "" for a single-option product. */
  label: string;
  /** Overrides the product price; null = product price. */
  priceCents: number | null;
  /** null = unlimited (print on demand). */
  stock: number | null;
  sku: string | null;
  sortOrder: number;
};

export type MerchProductDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  photoUrl: ImageUrl | null;
  priceCents: number;
  fulfillment: MerchFulfillment;
  providerRef: string | null;
  active: boolean;
  sortOrder: number;
  variants: MerchVariantDto[];
  /** No variant can be bought. */
  soldOut: boolean;
  /** Cheapest variant price. */
  fromCents: number;
  updatedAt: IsoDate;
};

export type MerchOrderLineDto = {
  variantId: string;
  productName: string;
  variantLabel: string;
  qty: number;
  unitCents: number;
};

export type MerchOrderSummaryDto = {
  id: string;
  /** Short reference shown to customers, e.g. "A1B2C3". */
  ref: string;
  status: MerchOrderStatus;
  name: string | null;
  email: string | null;
  delivery: 'ship' | 'pickup';
  lines: MerchOrderLineDto[];
  totalCents: number;
  createdAt: IsoDate;
};

export type MerchAddressDto = {
  name?: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

export type MerchOrderDto = MerchOrderSummaryDto & {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  shippingAddress: MerchAddressDto | null;
  trackingNumber: string | null;
  fulfilledAt: IsoDate | null;
  /** Link to the payment in the Stripe dashboard (refunds happen there). */
  stripePaymentUrl: string | null;
};

/** One variant row from the product editor. Strings as typed; the site validates. */
export type MerchVariantInput = {
  /** "" for a new variant. Existing variants left out of the list are deleted. */
  id: string;
  size: string;
  color: string;
  /** Dollars like "32" or "32.50"; "" = product price. */
  price: string;
  /** Whole number; "" = unlimited. */
  stock: string;
  sku: string;
};

export type MerchOps = {
  'merch.overview': {
    input: Empty;
    output: { products: MerchProductDto[]; toShip: number; stripeConfigured: boolean };
  };
  'merch.getProduct': { input: { id: string }; output: MerchProductDto };
  /**
   * Create (id "") or update a product with its full variant list. Optional
   * multipart file part `photo` (jpg/png/webp, ≤ 8 MB) replaces the photo.
   * Field errors keyed by input name; variant errors as `variants`.
   */
  'merch.saveProduct': {
    input: {
      id: string;
      name: string;
      /** "" = made from the name. Public link /merch/<slug>. */
      slug: string;
      description: string;
      /** Dollars like "28" or "28.50". */
      price: string;
      fulfillment: MerchFulfillment;
      providerRef: string;
      sortOrder: number;
      active: boolean;
      variants: MerchVariantInput[];
    };
    output: { product: MerchProductDto; created: boolean };
  };
  'merch.setActive': { input: { id: string; active: boolean }; output: MerchProductDto };
  /** Quick stock change for one variant; null = unlimited. */
  'merch.setStock': { input: { variantId: string; stock: number | null }; output: MerchProductDto };
  /** Past orders keep their item names (lines are copied onto the order). */
  'merch.deleteProduct': { input: { id: string }; output: { deleted: true } };
  /** `active` = paid + fulfilled; `all` includes unpaid / abandoned / cancelled. */
  'merch.listOrders': {
    input: { show: 'active' | 'all' };
    output: { orders: MerchOrderSummaryDto[]; toShip: number };
  };
  'merch.getOrder': { input: { id: string }; output: MerchOrderDto };
  /** Paid or fulfilled orders only. `notify` emails the customer (shipped / ready at the truck). */
  'merch.fulfill': {
    input: { id: string; tracking: string; notify: boolean };
    output: { order: MerchOrderDto; emailed: boolean };
  };
  /**
   * Book-keeping only — refund the money in Stripe first. `cancelled` for
   * unpaid orders, `refunded` for paid / fulfilled ones.
   */
  'merch.setOrderStatus': {
    input: { id: string; status: 'cancelled' | 'refunded' };
    output: MerchOrderDto;
  };
};
