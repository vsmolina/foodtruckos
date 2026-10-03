import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { v7 } from './uuid';

// --- Shared column builders -------------------------------------------------
// Every row is time-ordered by a UUIDv7 PK and carries audit timestamps.
const id = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => v7());

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// --- Enums ------------------------------------------------------------------
export const orderStatus = pgEnum('order_status', ['open', 'fulfilled', 'cancelled', 'refunded']);
export const kitchenTicketState = pgEnum('kitchen_ticket_state', [
  'pending',
  'in_progress',
  'done',
  'cancelled',
]);
// Menu → Square Catalog sync state (Phase 5). 'local' = never pushed.
export const squareSyncStatus = pgEnum('square_sync_status', ['local', 'pending', 'synced', 'error']);

// --- Business / stores ------------------------------------------------------
export const businesses = pgTable('businesses', {
  id: id(),
  name: text('name').notNull(),
  squareMerchantId: text('square_merchant_id').unique(),
  timezone: text('timezone').notNull().default('America/Chicago'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const stores = pgTable(
  'stores',
  {
    id: id(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    name: text('name').notNull(),
    squareLocationId: text('square_location_id').unique(),
    // Last successful "Pull from Square" catalog import. Pushing menu edits to a
    // production catalog is refused until this is set, so placeholder seed data
    // can never overwrite the real POS menu.
    catalogPulledAt: timestamp('catalog_pulled_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('stores_business_id_idx').on(t.businessId)],
);

// --- Menu -------------------------------------------------------------------
export const menuCategories = pgTable(
  'menu_categories',
  {
    id: id(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    // Square CatalogCategory id + its object version (needed for the next upsert).
    squareId: text('square_id'),
    squareVersion: bigint('square_version', { mode: 'number' }),
    syncStatus: squareSyncStatus('sync_status').notNull().default('local'),
    syncError: text('sync_error'),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('menu_categories_store_id_idx').on(t.storeId)],
);

export const menuItems = pgTable(
  'menu_items',
  {
    id: id(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => menuCategories.id),
    name: text('name').notNull(),
    description: text('description'),
    sku: text('sku'),
    isAvailable: boolean('is_available').notNull().default(true),
    // Square CatalogItem id. Price is NOT here — it lives on the variation.
    squareId: text('square_id'),
    squareVersion: bigint('square_version', { mode: 'number' }),
    syncStatus: squareSyncStatus('sync_status').notNull().default('local'),
    syncError: text('sync_error'),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('menu_items_category_id_idx').on(t.categoryId)],
);

// Price lives on the variation (Square's model). A simple item has one default.
export const menuItemVariations = pgTable(
  'menu_item_variations',
  {
    id: id(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => menuItems.id),
    name: text('name').notNull(),
    priceCents: integer('price_cents').notNull(),
    // Square ItemVariation id + version.
    squareId: text('square_id'),
    squareVersion: bigint('square_version', { mode: 'number' }),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('menu_item_variations_item_id_idx').on(t.itemId)],
);

export const menuModifiers = pgTable(
  'menu_modifiers',
  {
    id: id(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => menuItems.id),
    name: text('name').notNull(),
    priceCentsDelta: integer('price_cents_delta').notNull().default(0),
    isRequired: boolean('is_required').notNull().default(false),
    // Square CatalogModifier id and its parent ModifierList id, with versions.
    squareId: text('square_id'),
    squareVersion: bigint('square_version', { mode: 'number' }),
    squareModifierListId: text('square_modifier_list_id'),
    squareModifierListVersion: bigint('square_modifier_list_version', { mode: 'number' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('menu_modifiers_item_id_idx').on(t.itemId)],
);

// --- Orders -----------------------------------------------------------------
export const orders = pgTable(
  'orders',
  {
    id: id(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    squareOrderId: text('square_order_id').unique(),
    // Square's optimistic-concurrency version, used for idempotency.
    squareVersion: integer('square_version'),
    status: orderStatus('status').notNull().default('open'),
    // Money is integer cents. Never floats.
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    taxCents: integer('tax_cents').notNull().default(0),
    tipCents: integer('tip_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull().default(0),
    // Full hydrated Square order, kept for debugging.
    rawPayload: jsonb('raw_payload'),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('orders_store_id_idx').on(t.storeId),
    index('orders_status_idx').on(t.status),
    index('orders_opened_at_idx').on(t.openedAt),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    // null if Square sent an item we don't know.
    menuItemId: uuid('menu_item_id').references(() => menuItems.id),
    // Item name at time of order — snapshot, never back-filled.
    nameSnapshot: text('name_snapshot').notNull(),
    qty: integer('qty').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    lineTotalCents: integer('line_total_cents').notNull(),
    notes: text('notes'),
  },
  (t) => [index('order_items_order_id_idx').on(t.orderId)],
);

export const orderItemModifiers = pgTable(
  'order_item_modifiers',
  {
    id: id(),
    orderItemId: uuid('order_item_id')
      .notNull()
      .references(() => orderItems.id),
    nameSnapshot: text('name_snapshot').notNull(),
    priceCentsDelta: integer('price_cents_delta').notNull().default(0),
  },
  (t) => [index('order_item_modifiers_order_item_id_idx').on(t.orderItemId)],
);

// Populated from payment.* webhooks. Read-only in MVP.
export const payments = pgTable(
  'payments',
  {
    id: id(),
    orderId: uuid('order_id').references(() => orders.id),
    squarePaymentId: text('square_payment_id').notNull().unique(),
    amountCents: integer('amount_cents').notNull(),
    tipCents: integer('tip_cents').notNull().default(0),
    // Square payment status, e.g. 'COMPLETED'.
    status: text('status').notNull(),
    cardBrand: text('card_brand'),
    rawPayload: jsonb('raw_payload'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('payments_order_id_idx').on(t.orderId)],
);

// Our addition: the kitchen timer/station/state for an order.
export const kitchenTickets = pgTable(
  'kitchen_tickets',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .unique()
      .references(() => orders.id),
    state: kitchenTicketState('state').notNull().default('pending'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    // 'grill', 'fryer', etc. Not used in MVP.
    station: text('station'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('kitchen_tickets_state_idx').on(t.state)],
);

// Idempotency + audit log for inbound webhooks.
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: id(),
    source: text('source').notNull(),
    // Square's event_id — the idempotency key.
    externalId: text('external_id').notNull().unique(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    signatureValid: boolean('signature_valid').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    error: text('error'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('webhook_events_external_id_uidx').on(t.externalId),
    index('webhook_events_event_type_idx').on(t.eventType),
  ],
);

// --- Auth.js (NextAuth v5) --------------------------------------------------
// Tables required by @auth/drizzle-adapter. Column *property names* are
// load-bearing (the adapter reads by JS key); DB column names may be snake_case.
// We keep the project's uuid/v7 PK convention — the adapter accepts PgUUID ids.
// `mode: 'date'` is required on token/expiry columns (the adapter passes Dates).
// Sign-in is email + password (Credentials provider, JWT sessions). `passwordHash`
// holds a scrypt digest (see lib/auth/password.ts); the accounts/sessions/
// verificationTokens tables below are legacy adapter tables, unused by the
// credentials flow but kept so existing migrations stay valid.
export const users = pgTable('users', {
  id: id(),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true, mode: 'date' }),
  image: text('image'),
  passwordHash: text('password_hash'),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);
