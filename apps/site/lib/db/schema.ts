import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';

// The website's own database (separate from the truck's foodtruck-os DB; see
// PLAN.md → Integration). Square is the bridge for menu and food orders; this
// database holds the status switch, the menu cache + web-only fields, and
// everything that only the website needs. Money is integer cents; times UTC.

const id = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7());
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------------------------------------------------------------- status ----

export const truckStatus = pgEnum('truck_status', ['open', 'closed', 'back_soon']);

/** Single row (id = 1): the one source of truth for open / closed / back soon. */
export const siteSettings = pgTable('site_settings', {
  id: smallint('id').primaryKey().default(1),
  status: truckStatus('status').notNull().default('closed'),
  /** Shown under the banner, e.g. "Back on the Square Friday". */
  statusMessage: text('status_message'),
  orderingPaused: boolean('ordering_paused').notNull().default(false),
  pausedMessage: text('paused_message'),
  /** Fallback wait when the kitchen queue can't be read. */
  defaultWaitMinutes: integer('default_wait_minutes').notNull().default(10),
  locationName: text('location_name').notNull().default('The Square, behind Harper’s'),
  address: text('address').notNull().default('San Marcos, TX 78666'),
  lat: text('lat').notNull().default('29.8830'),
  lng: text('lng').notNull().default('-97.9411'),
  lateNightNote: text('late_night_note'),
  phone: text('phone'),
  instagram: text('instagram').notNull().default('barrioburgerco'),
  updatedAt: updatedAt(),
});

/** Weekly hours, display only (status is set by hand). `closes` may be past midnight. */
export const weeklyHours = pgTable('weekly_hours', {
  dayOfWeek: smallint('day_of_week').primaryKey(), // 0 = Sunday
  opens: text('opens'), // "20:30"
  closes: text('closes'), // "03:00"
  closed: boolean('closed').notNull().default(false),
  note: text('note'),
});

// ------------------------------------------------------------------ menu ----

/** Cache of the Square catalog plus web-only fields (photo, Spanish label, sort). */
export const menuCategories = pgTable(
  'menu_categories',
  {
    id: id(),
    squareId: text('square_id').unique(),
    name: text('name').notNull(),
    labelEs: text('label_es'),
    sortOrder: integer('sort_order').notNull().default(0),
    hidden: boolean('hidden').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
);

export const menuItems = pgTable(
  'menu_items',
  {
    id: id(),
    categoryId: uuid('category_id').references(() => menuCategories.id, { onDelete: 'set null' }),
    squareId: text('square_id').unique(),
    name: text('name').notNull(),
    description: text('description'),
    taglineEs: text('tagline_es'),
    photoUrl: text('photo_url'),
    /** Photo set on the website; wins over the Square image. */
    photoOverrideUrl: text('photo_override_url'),
    soldOut: boolean('sold_out').notNull().default(false),
    /** Sold out at the location in Square (read on sync). */
    squareSoldOut: boolean('square_sold_out').notNull().default(false),
    hidden: boolean('hidden').notNull().default(false),
    isNew: boolean('is_new').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('menu_items_category_idx').on(t.categoryId)],
);

/** Sizes / prices. Every item has at least one; orders reference these. */
export const menuVariations = pgTable(
  'menu_variations',
  {
    id: id(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    squareId: text('square_id').unique(),
    name: text('name').notNull().default('Regular'),
    priceCents: integer('price_cents').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('menu_variations_item_idx').on(t.itemId)],
);

/** Modifier choices ("No Onions", "Add Bacon"), grouped by Square modifier list. */
export const menuModifiers = pgTable(
  'menu_modifiers',
  {
    id: id(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    squareId: text('square_id'),
    groupName: text('group_name').notNull().default('Options'),
    /** Max picks in the group; 1 = choose one, null = any number. */
    groupMax: integer('group_max'),
    groupRequired: boolean('group_required').notNull().default(false),
    name: text('name').notNull(),
    priceCents: integer('price_cents').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('menu_modifiers_item_idx').on(t.itemId)],
);

export const specials = pgTable('specials', {
  id: id(),
  title: text('title').notNull(),
  /** Hand-lettered Spanish kicker, e.g. "¡Nuevo!". */
  kicker: text('kicker'),
  body: text('body'),
  priceLabel: text('price_label'),
  photoUrl: text('photo_url'),
  menuItemId: uuid('menu_item_id').references(() => menuItems.id, { onDelete: 'set null' }),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ------------------------------------------------------------ web orders ----

export const webOrderStatus = pgEnum('web_order_status', [
  'pending_payment',
  'received',
  'preparing',
  'ready',
  'picked_up',
  'cancelled',
  'failed',
]);

export type WebOrderLine = {
  variationId: string;
  itemName: string;
  variationName: string;
  qty: number;
  unitCents: number;
  modifiers: Array<{ id: string; name: string; priceCents: number }>;
  note?: string;
};

export const webOrders = pgTable(
  'web_orders',
  {
    id: id(),
    /** Short code shown to the customer and called at the window, e.g. "B7K2". */
    code: text('code').notNull().unique(),
    /** Unguessable token in the status-page URL. */
    token: text('token').notNull().unique(),
    status: webOrderStatus('status').notNull().default('pending_payment'),
    squareOrderId: text('square_order_id').unique(),
    squarePaymentId: text('square_payment_id'),
    customerName: text('customer_name').notNull(),
    phone: text('phone').notNull(),
    smsOptIn: boolean('sms_opt_in').notNull().default(false),
    smsConsentText: text('sms_consent_text'),
    readySmsSentAt: timestamp('ready_sms_sent_at', { withTimezone: true }),
    lines: jsonb('lines').$type<WebOrderLine[]>().notNull(),
    subtotalCents: integer('subtotal_cents').notNull(),
    taxCents: integer('tax_cents').notNull().default(0),
    tipCents: integer('tip_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull(),
    partnerId: uuid('partner_id').references(() => partners.id, { onDelete: 'set null' }),
    estimatedReadyAt: timestamp('estimated_ready_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    readyAt: timestamp('ready_at', { withTimezone: true }),
    error: text('error'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('web_orders_created_idx').on(t.createdAt), index('web_orders_partner_idx').on(t.partnerId)],
);

// -------------------------------------------------------------- partners ----

export const partnerKind = pgEnum('partner_kind', ['bar', 'bartender', 'other']);

export const partners = pgTable('partners', {
  id: id(),
  name: text('name').notNull(),
  kind: partnerKind('kind').notNull().default('bar'),
  blurb: text('blurb'),
  photoUrl: text('photo_url'),
  instagram: text('instagram'),
  url: text('url'),
  /** Referral code, upper-case, used in /r/CODE links and QR codes. */
  code: text('code').notNull().unique(),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** One row per referral link / QR scan. No IPs, no cookies beyond the code. */
export const partnerVisits = pgTable(
  'partner_visits',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    partnerId: uuid('partner_id')
      .notNull()
      .references(() => partners.id, { onDelete: 'cascade' }),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('partner_visits_partner_idx').on(t.partnerId, t.at)],
);

// --------------------------------------------------------------- gallery ----

export const photoStatus = pgEnum('photo_status', ['pending', 'approved', 'rejected', 'removed']);
export const photoSource = pgEnum('photo_source', ['owner', 'submission']);

export const galleryPhotos = pgTable(
  'gallery_photos',
  {
    id: id(),
    url: text('url').notNull(),
    width: integer('width'),
    height: integer('height'),
    caption: text('caption'),
    source: photoSource('source').notNull(),
    status: photoStatus('status').notNull().default('pending'),
    submitterName: text('submitter_name'),
    submitterEmail: text('submitter_email'),
    submitterInstagram: text('submitter_instagram'),
    /** Everyone identifiable has agreed to be published. Required to approve. */
    consentConfirmed: boolean('consent_confirmed').notNull().default(false),
    consentText: text('consent_text'),
    consentAt: timestamp('consent_at', { withTimezone: true }),
    /** Who confirmed: "submitter" or "admin". */
    consentBy: text('consent_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('gallery_status_idx').on(t.status, t.createdAt)],
);

export const takedownRequests = pgTable('takedown_requests', {
  id: id(),
  photoId: uuid('photo_id').references(() => galleryPhotos.id, { onDelete: 'set null' }),
  description: text('description'),
  name: text('name').notNull(),
  email: text('email').notNull(),
  reason: text('reason'),
  status: text('status').notNull().default('open'), // open | done
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: createdAt(),
});

// ------------------------------------------------------------- instagram ----

/**
 * Single row (id = 1): the owner's connected Instagram professional account.
 * The token is a long-lived Instagram API token (60 days); lib/instagram.ts
 * renews it weekly so it never lapses. Never sent to a browser.
 */
export const instagramAccount = pgTable('instagram_account', {
  id: smallint('id').primaryKey().default(1),
  accessToken: text('access_token').notNull(),
  igUserId: text('ig_user_id').notNull(),
  username: text('username').notNull(),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  tokenRefreshedAt: timestamp('token_refreshed_at', { withTimezone: true }).notNull().defaultNow(),
  /** Last time a fetch was started (also the lock that keeps refreshes from overlapping). */
  lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
  lastError: text('last_error'),
  connectedAt: createdAt(),
});

/**
 * The latest posts: just enough to embed them (Instagram renders the post
 * itself; we store no images or captions).
 */
export const instagramPosts = pgTable('instagram_posts', {
  /** Instagram media id. */
  id: text('id').primaryKey(),
  permalink: text('permalink').notNull(),
  mediaType: text('media_type').notNull(), // IMAGE | VIDEO | CAROUSEL_ALBUM
  postedAt: timestamp('posted_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

// -------------------------------------------------------------- catering ----

export const leadStatus = pgEnum('lead_status', ['new', 'contacted', 'quoted', 'booked', 'declined']);

export const cateringLeads = pgTable(
  'catering_leads',
  {
    id: id(),
    status: leadStatus('status').notNull().default('new'),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    email: text('email').notNull(),
    eventDate: date('event_date').notNull(),
    startTime: text('start_time').notNull(),
    durationHours: text('duration_hours').notNull(),
    location: text('location').notNull(),
    guestCount: integer('guest_count').notNull(),
    eventType: text('event_type').notNull(),
    serviceStyle: text('service_style').notNull(),
    menuInterests: text('menu_interests').array().notNull().default(sql`'{}'::text[]`),
    budgetRange: text('budget_range'),
    notes: text('notes'),
    adminNotes: text('admin_notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('catering_status_idx').on(t.status, t.createdAt)],
);

// ----------------------------------------------------------- subscribers ----

export const subscribers = pgTable(
  'subscribers',
  {
    id: id(),
    email: text('email'),
    phone: text('phone'), // E.164
    emailOptIn: boolean('email_opt_in').notNull().default(false),
    smsOptIn: boolean('sms_opt_in').notNull().default(false),
    consentText: text('consent_text').notNull(),
    consentAt: timestamp('consent_at', { withTimezone: true }).notNull().defaultNow(),
    source: text('source').notNull().default('website'),
    emailUnsubscribedAt: timestamp('email_unsubscribed_at', { withTimezone: true }),
    smsStoppedAt: timestamp('sms_stopped_at', { withTimezone: true }),
    /** Token for the one-click email unsubscribe link. */
    unsubscribeToken: text('unsubscribe_token').notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('subscribers_email_uq').on(t.email),
    uniqueIndex('subscribers_phone_uq').on(t.phone),
  ],
);

export const broadcasts = pgTable('broadcasts', {
  id: id(),
  specialId: uuid('special_id').references(() => specials.id, { onDelete: 'set null' }),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  sendEmail: boolean('send_email').notNull().default(true),
  sendSms: boolean('send_sms').notNull().default(false),
  emailCount: integer('email_count').notNull().default(0),
  smsCount: integer('sms_count').notNull().default(0),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: createdAt(),
});

// ----------------------------------------------------------------- merch ----

export const merchProducts = pgTable('merch_products', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  photoUrl: text('photo_url'),
  priceCents: integer('price_cents').notNull(),
  /** 'self' = we pack and ship; 'pod' = a print-on-demand provider (see lib/merch/fulfillment.ts). */
  fulfillment: text('fulfillment').notNull().default('self'),
  /** Provider's product/template id when fulfillment = 'pod'. */
  providerRef: text('provider_ref'),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const merchVariants = pgTable(
  'merch_variants',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => merchProducts.id, { onDelete: 'cascade' }),
    size: text('size'),
    color: text('color'),
    /** Overrides the product price (e.g. 2XL costs more). */
    priceCents: integer('price_cents'),
    /** null = unlimited (print on demand). */
    stock: integer('stock'),
    sku: text('sku'),
    providerRef: text('provider_ref'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('merch_variants_product_idx').on(t.productId)],
);

export const merchOrderStatus = pgEnum('merch_order_status', [
  'pending',
  'paid',
  'fulfilled',
  'cancelled',
  'refunded',
]);

export type MerchOrderLine = {
  variantId: string;
  productName: string;
  variantLabel: string;
  qty: number;
  unitCents: number;
};

export const merchOrders = pgTable(
  'merch_orders',
  {
    id: id(),
    status: merchOrderStatus('status').notNull().default('pending'),
    stripeSessionId: text('stripe_session_id').unique(),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    email: text('email'),
    name: text('name'),
    /** 'ship' or 'pickup' (at the truck). */
    delivery: text('delivery').notNull().default('ship'),
    shippingAddress: jsonb('shipping_address'),
    lines: jsonb('lines').$type<MerchOrderLine[]>().notNull(),
    subtotalCents: integer('subtotal_cents').notNull(),
    shippingCents: integer('shipping_cents').notNull().default(0),
    taxCents: integer('tax_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull().default(0),
    trackingNumber: text('tracking_number'),
    fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('merch_orders_created_idx').on(t.createdAt)],
);

// ------------------------------------------------------------- analytics ----

/** Privacy-light page views: path + referrer host only. No IP, no cookie id. */
export const pageViews = pgTable(
  'page_views',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    path: text('path').notNull(),
    referrerHost: text('referrer_host'),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('page_views_at_idx').on(t.at)],
);

// ------------------------------------------------------------- plumbing ----

/** Fixed-window rate limits shared by all server instances. */
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

/** Every SMS and email sent (or logged in dev when no provider is configured). */
export const messageLog = pgTable(
  'message_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    channel: text('channel').notNull(), // sms | email
    to: text('to').notNull(),
    subject: text('subject'),
    body: text('body').notNull(),
    status: text('status').notNull(), // sent | logged | failed
    providerId: text('provider_id'),
    error: text('error'),
    createdAt: createdAt(),
  },
  (t) => [index('message_log_created_idx').on(t.createdAt)],
);
