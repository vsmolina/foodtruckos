# 02 — Build Spec (for Claude Code)

> **Claude Code: read this file top-to-bottom before writing a single line of code.** Execute in phase order. Do not jump ahead. After each phase, stop and report to the user for review before starting the next phase.

This document is authoritative. If it conflicts with `01-ARCHITECTURE.md`, this file wins (it's more specific). If something is ambiguous, **ask the user before guessing** — do not fabricate Square API fields, do not invent business rules. The official `square` Node SDK is the source of truth for request/response shapes; prefer it over hand-rolled REST calls.

---

## Ground rules

1. **Money is always integer cents.** Never floats. A price is `1299` (USD cents), not `12.99`. All DB columns are `integer` or `bigint`. Display conversion happens only in the UI.
2. **All times are UTC in the DB.** Use the truck's local timezone (`America/Chicago`) only at the UI edge.
3. **Every external call has a timeout.** Default 5 seconds. The Square webhook handler must return ≤2 seconds — including the `RetrieveOrder` hydration call. If hydration can't reliably finish in time, return 200 immediately and defer hydration to a BullMQ job.
4. **Idempotency everywhere.** Webhook handlers, button clicks, API POSTs — same input twice must produce one effect.
5. **No `any` in TypeScript.** Use `unknown` and narrow it, or model the type.
6. **Secrets never in code.** `.env` only. `.env.example` checked in, `.env` in `.gitignore`.
7. **Commit after every completed sub-task**, not per phase. Messages follow Conventional Commits: `feat(kds): render order grid`, `fix(square): handle missing tax field`, `chore(db): add kitchen_ticket index`.
8. **Every new feature gets at least one test.** KDS flows get E2E tests in Playwright.
9. **No `console.log` in committed code.** Use the Pino logger.
10. **Ask before installing heavy dependencies.** If a package adds >500KB, justify it.

---

## Phase 0 — Repo bootstrap

Goal: a working pnpm monorepo with Next.js that builds and lints cleanly.

### Tasks

1. At `~/Code/foodtruck-os/`:

   ```bash
   pnpm init
   ```

   Edit `package.json` to add `"packageManager": "pnpm@9.x"` (use the current pnpm version), `"private": true`, `"workspaces": ["apps/*", "packages/*"]`.

2. Create `pnpm-workspace.yaml`:

   ```yaml
   packages:
     - 'apps/*'
     - 'packages/*'
   ```

3. Scaffold the Next.js app:

   ```bash
   cd apps
   pnpm create next-app@latest web --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --no-turbopack
   ```

   When asked about Turbopack, **decline** — we want stability for MVP.

4. In `apps/web`, set up strict TypeScript. Update `tsconfig.json`:

   ```json
   {
     "compilerOptions": {
       "strict": true,
       "noUncheckedIndexedAccess": true,
       "noImplicitOverride": true,
       "exactOptionalPropertyTypes": true,
       "forceConsistentCasingInFileNames": true
     }
   }
   ```

5. Add Prettier + ESLint rules:

   ```bash
   pnpm add -D -w prettier eslint-config-prettier @typescript-eslint/eslint-plugin
   ```

   Create `.prettierrc` with `{ "semi": true, "singleQuote": true, "trailingComma": "all", "printWidth": 100 }`.

6. Create `.gitignore` at repo root covering `node_modules`, `.next`, `.env`, `.env.local`, `*.pem`, `dist`, `coverage`, `.DS_Store`.

7. Create `.env.example` at repo root with every env var the project will use (see Phase 1–3). `.env` is a copy the user fills in.

8. Create `README.md` that links to `docs/00-PREFLIGHT.md` as the starting point and lists `pnpm dev`, `pnpm build`, `pnpm test`, `docker compose up` as the common commands.

### Exit criteria

- `pnpm install` succeeds.
- `pnpm --filter web dev` starts on port 3000 and shows the default Next.js page.
- `pnpm --filter web build` completes with no errors.
- `git log` shows at least one commit.

---

## Phase 1 — Docker + Postgres + Redis + base schema

Goal: the full infra stack starts with one command. The database has the schema. The app connects to both.

### Tasks

1. Create `infra/docker-compose.yml` with three services: `postgres:16-alpine`, `redis:7-alpine`, `web` (builds from `infra/Dockerfile.web`). Expose Postgres on 5432 and Redis on 6379 _only to the Docker network_, not the host. The web service exposes port 3000 to the host. Use named volumes for Postgres data and Redis AOF.

2. Create `infra/docker-compose.dev.yml` that overrides `web` to mount the repo and run `pnpm dev`. In production compose, `web` runs the built output.

3. Create `infra/Dockerfile.web` — multi-stage: `deps` (install), `builder` (build), `runner` (run). Use `node:22-alpine`. Runner runs as a non-root user.

4. Install Drizzle:

   ```bash
   cd apps/web
   pnpm add drizzle-orm postgres
   pnpm add -D drizzle-kit
   ```

5. Create `apps/web/lib/db/schema.ts` with the tables below. Use `pgTable`, `uuid('id').primaryKey().$defaultFn(() => v7())` with a UUIDv7 helper in `lib/db/uuid.ts`.

   **Tables for Phase 1:**
   - `businesses` — `id, name, square_merchant_id (text, unique), timezone (text, default 'America/Chicago'), created_at, updated_at`
   - `stores` — `id, business_id (fk), name, square_location_id (text, unique), created_at, updated_at`
   - `menu_categories` — `id, store_id (fk), name, sort_order (int), square_id (text, nullable — Square CatalogCategory id), created_at, updated_at`
   - `menu_items` — `id, category_id (fk), name, description (text, nullable), sku (text, nullable), is_available (boolean, default true), square_id (text, nullable — Square CatalogItem id), created_at, updated_at`
     > **Note:** price is NOT on the item — Square puts it on the variation. See `menu_item_variations` below. For a simple item, seed one default variation.
   - `menu_item_variations` — `id, item_id (fk), name (text — e.g. 'Regular', 'Large'), price_cents (integer, not null), square_id (text, nullable — Square ItemVariation id), is_default (boolean, default false), created_at, updated_at`
   - `menu_modifiers` — `id, item_id (fk), name, price_cents_delta (integer, default 0), is_required (boolean, default false), square_id (text, nullable — Square CatalogModifier id), square_modifier_list_id (text, nullable), created_at, updated_at`
   - `orders` — `id, store_id (fk), square_order_id (text, unique, nullable), square_version (integer, nullable — Square's optimistic-concurrency version, used for idempotency), status (enum: 'open'|'fulfilled'|'cancelled'|'refunded'), subtotal_cents (integer), tax_cents (integer), tip_cents (integer, default 0), total_cents (integer), raw_payload (jsonb, nullable — the full hydrated Square order for debugging), opened_at (timestamp), closed_at (timestamp, nullable), created_at, updated_at`
   - `order_items` — `id, order_id (fk), menu_item_id (fk, nullable — null if Square sent an item we don't know), name_snapshot (text — item name at time of order), qty (integer), unit_price_cents (integer), line_total_cents (integer), notes (text, nullable)`
   - `order_item_modifiers` — `id, order_item_id (fk), name_snapshot (text), price_cents_delta (integer)`
   - `payments` — `id, order_id (fk, nullable), square_payment_id (text, unique), amount_cents (integer), tip_cents (integer, default 0), status (text — Square payment status, e.g. 'COMPLETED'), card_brand (text, nullable), raw_payload (jsonb, nullable), created_at, updated_at` — populated from `payment.*` webhooks, read-only in MVP.
   - `kitchen_tickets` — `id, order_id (fk, unique), state (enum: 'pending'|'in_progress'|'done'|'cancelled'), started_at (timestamp, not null), completed_at (timestamp, nullable), station (text, nullable — 'grill', 'fryer', etc., not used in MVP), created_at, updated_at`
   - `webhook_events` — `id, source (text — 'square'), external_id (text, unique — Square's `event_id`), event_type (text — e.g. 'order.created'), payload (jsonb), signature_valid (boolean), processed_at (timestamp, nullable), error (text, nullable), received_at (timestamp)`

   **All `created_at` / `updated_at` are `timestamp with time zone not null default now()`.**

6. Create `apps/web/drizzle.config.ts` and `apps/web/lib/db/client.ts` that connects using `DATABASE_URL` from env.

7. Create migration files:

   ```bash
   pnpm --filter web exec drizzle-kit generate
   ```

   Commit them under `apps/web/drizzle/`.

8. Add an `apps/web/lib/db/migrate.ts` script that runs migrations on startup, and wire it into the web Dockerfile's entrypoint.

9. Add Redis client `apps/web/lib/redis.ts` using `ioredis`. Create a pub/sub helper `lib/realtime/channel.ts` with `publish(channel, payload)` and `subscribe(channel, handler)`.

10. Create a health check route `apps/web/app/api/health/route.ts` that returns `{ db: 'ok'|'fail', redis: 'ok'|'fail', time: ISO }` — useful for monitoring and for Cloudflare Tunnel.

11. Seed data. Create `apps/web/lib/db/seed.ts` with a `pnpm db:seed` script. Insert:
    - One business ("Victor's Food Truck").
    - One store ("San Marcos").
    - Categories: "Burgers", "Hot Dogs", "Sides", "Drinks".
    - Items: at least 8 realistic items (Mexican-style burger and bacon-wrapped hot dog names Victor's business runs — ask the user for the real menu; otherwise use placeholders clearly marked `TODO`). Each item gets one default `menu_item_variations` row carrying its `price_cents` (Square's model — price lives on the variation). Add a second variation to one or two items (e.g. Regular/Large) to exercise the relationship.

### Exit criteria

- `docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up` starts three healthy containers.
- `curl localhost:3000/api/health` returns `{ db: 'ok', redis: 'ok', ... }`.
- `pnpm --filter web db:seed` inserts data; a manual `psql` query confirms it.

---

## Phase 2 — Square webhook ingestion

Goal: a real Square `order.created` webhook arrives, is verified, the order is hydrated via the Orders API, and it creates an order + kitchen ticket visible in the database.

> **Key Square fact that shapes this phase:** `order.*` webhooks are _thin_. The payload's `data.object.order_created` (or `order_updated`) gives you `order_id`, `version`, `state`, `location_id` — **not** line items or totals. You must call `RetrieveOrder` to hydrate. `payment.*` webhooks, by contrast, carry the full payment object.

### Tasks

1. Install the Square SDK:

   ```bash
   cd apps/web
   pnpm add square
   ```

2. Create `apps/web/lib/square/client.ts`:
   - Constructs a Square `Client` from `SQUARE_ACCESS_TOKEN` and `SQUARE_ENVIRONMENT` (`sandbox` | `production`).
   - For a single merchant this is a **personal access token** — no JWT, no RSA, no token exchange, no Redis token cache (that whole Poynt dance is gone).
   - Exposes `retrieveOrder(orderId)`, `listOrders(locationId, params)`, `updateOrderFulfillment(orderId, version, state)`. All calls wrapped with a 5s timeout.

3. Create `apps/web/lib/square/webhook.ts`:
   - `verifySignature(rawBody, signatureHeader, notificationUrl, signatureKey) => boolean`.
   - Square's scheme: HMAC-SHA256 over the string `notificationUrl + rawBody`, base64-encoded, compared (constant-time) against the **`x-square-hmacsha256-signature`** header. The `square` SDK ships `WebhooksHelper.isValidWebhookEventSignature(...)` — use it rather than hand-rolling. `notificationUrl` must exactly match the URL configured in the subscription (`https://api.yourdomain.com/api/webhooks/square`).
   - `signatureKey` = `SQUARE_WEBHOOK_SIGNATURE_KEY`.

4. Create the route handler `apps/web/app/api/webhooks/square/route.ts`:
   - `POST` only.
   - Reads raw body (`await req.text()`) — keep the raw string for signature verification, then `JSON.parse`.
   - Extracts Square's `event_id`; look it up in `webhook_events` as `external_id`. If already `processed_at`, return 200 immediately (idempotent).
   - Verifies signature. If invalid, insert `webhook_events` with `signature_valid: false` and return 401.
   - Dispatches on `event.type`:
     - `order.created`: **hydrate** via `retrieveOrder(order_id)`, then upsert order + order_items (+ modifiers), create `kitchen_tickets` row (state=pending, started_at=now), publish to Redis `kds:store:<store_id>`. Resolve `store_id` from the order's `location_id`.
     - `order.updated`: re-hydrate, upsert (guard with `square_version` — ignore an event whose version ≤ the stored version), re-emit kitchen ticket payload. When the order's `state` becomes `COMPLETED`/`CANCELED`, mirror it (see below).
     - `order.fulfillment.updated`: update fulfillment state; do **not** mark the kitchen ticket done (the cook does that on the KDS).
     - `payment.created` / `payment.updated`: upsert into `payments`, attach to the order. Read-only in MVP.
   - On a `CANCELED` order: mark order cancelled, kitchen ticket cancelled, publish removal.
   - Mark `webhook_events.processed_at = now()`.
   - Return 200 within 2s. **If hydration risks blowing the 2s budget, write the `webhook_events` row, enqueue a BullMQ `square.ingest` job, and return 200 now.** Square retries non-2xx with backoff.

5. Register the webhook subscription. Two options — document both in `docs/TESTING.md`:
   - **Dashboard (simplest):** Developer Dashboard → your app → **Webhooks → Subscriptions → Add**. URL = `https://api.yourdomain.com/api/webhooks/square`, API version pinned, events: `order.created`, `order.updated`, `order.fulfillment.updated`, `payment.created`, `payment.updated`. Copy the **Signature Key** into `.env` as `SQUARE_WEBHOOK_SIGNATURE_KEY`.
   - **Script:** `scripts/register-square-webhook.ts` using the Webhook Subscriptions API to create the subscription programmatically (handy for redeploys).

6. Add Cloudflare Tunnel to `infra/docker-compose.yml` as a fourth service (`cloudflared:latest`) using a mounted credentials file. The tunnel routes `api.yourdomain.com` → `web:3000`.

7. Write a manual test flow in `docs/TESTING.md`:
   - Ring up an itemized order on the Square POS (or the Square sandbox seller dashboard / `CreateOrder` + `CreatePayment` sandbox calls).
   - Watch logs: `docker compose logs -f web`.
   - Confirm rows in `webhook_events` and `orders`, and that line items hydrated correctly.

8. **Sandbox / mock fallback.** Square's **Sandbox** replaces Poynt's old "mock mode": set `SQUARE_ENVIRONMENT=sandbox` with a sandbox access token and signature key, and drive orders from the sandbox dashboard or API. Additionally provide `scripts/mock-square.ts` that POSTs a realistic thin `order.created` event (correctly signed with the configured signature key) to the local endpoint for offline E2E tests that don't hit Square at all — it stubs the `retrieveOrder` hydration with a fixture.

### Exit criteria

- A real Square order (or a sandbox/mock order) creates an `orders` row with hydrated line items and a `kitchen_tickets` row.
- Duplicate webhook delivery (same `event_id`, or an `order.updated` with a stale `version`) does not create duplicate rows or regress state.
- Invalid signatures are rejected (401) and logged with `signature_valid: false`.
- Redis `kds:store:<id>` channel receives a message on `order.created` (verify with `redis-cli subscribe`).

---

## Phase 3 — Kitchen Display System (KDS)

Goal: when a Square order arrives, it appears within 500ms on the Raspberry Pi's 9"x5" touchscreen as a card on a 4x2 grid with a live timer. Tapping a card marks it done and removes it.

### Tasks

1. Add Socket.IO:

   ```bash
   cd apps/web
   pnpm add socket.io socket.io-client
   ```

   Use the App Router custom server pattern documented in Socket.IO's Next.js guide. Create `apps/web/server.ts` that wraps the Next handler and attaches Socket.IO on the same HTTP server. Update the start script to `node server.js` after build.

2. On the server, Socket.IO joins clients to rooms by `storeId`. Subscribe to Redis `kds:store:*` channels and re-emit to the matching room. Events:
   - `ticket:created` — full ticket payload.
   - `ticket:updated` — state change or edits.
   - `ticket:removed` — completed, cancelled, or removed.

3. Route `apps/web/app/kds/page.tsx`:
   - Full-viewport layout. No nav, no header, no footer. **Exactly fits a 9"x5" landscape screen at 800x480 or 1024x600** — detect with `window.innerWidth/innerHeight`, set CSS custom props, use `vh`/`vw` carefully.
   - 4 columns × 2 rows grid. Gap 12px. Card aspect follows available space.
   - Each card shows: order number (short, e.g. "#142"), items (compact list with qty × name), modifiers (smaller text), total time elapsed (live-ticking, HH:MM:SS or MM:SS after < 1hr), visual color state:
     - 0–3 min: white/neutral background.
     - 3–7 min: amber border/tint.
     - 7+ min: red border/tint with subtle pulse.
   - Tap anywhere on the card → confirm modal (to prevent fat-finger) → emits `ticket:complete`.
   - Overflow (9+ active tickets): show a compact "+3 more" indicator on card 8 with the count; new tickets replace as slots free up. MVP does not paginate — if Victor consistently has >8 active tickets, we rethink.

4. Create `apps/web/components/kds/OrderCard.tsx`, `TimerDisplay.tsx` (memoized, updates every second via a single timer context — do NOT put a `setInterval` in every card), `CompleteConfirmModal.tsx`.

5. Styling follows `docs/03-DESIGN-SYSTEM.md`. No Tailwind "card border-gray-200 shadow-sm" generic look. Use design tokens.

6. Authentication for MVP: the `/kds` route is accessible only from the local network (enforce via middleware: check request IP is in `10.x`, `192.168.x`, `172.16–31.x`, or localhost). No passwords yet.

7. Configure the Raspberry Pi as a kiosk:
   - Create `scripts/pi-kiosk-setup.sh` that the user copies to the Pi and runs. It installs Chromium if not present, disables screen blanking, adds an `autostart` entry that launches Chromium in kiosk mode pointing at `http://<MAC_LOCAL_IP>:3000/kds?store=<STORE_ID>`.
   - Include instructions to find the Mac's LAN IP (`ipconfig getifaddr en0`).

8. E2E test with Playwright:
   - Simulate a `ticket:created` event via the `mock-square.ts` script (or a sandbox order).
   - Assert a card appears.
   - Click it, confirm, assert it's removed.
   - Assert the card hits the amber state after 3 minutes (fake the clock).

### Exit criteria

- Placing an order on Square (or firing the mock script) makes a card appear on the Pi within 1 second.
- Timer ticks accurately.
- Tap completes the order and removes the card.
- Killing and restarting the web service does not lose orders (they reload from DB on client connect — implement `ticket:snapshot` event on connect that sends all pending tickets).
- The Pi boots and the KDS comes up full-screen, no mouse needed.

---

## Phase 4 — Business Dashboard (PC)

Goal: Victor opens a browser on his laptop, logs in, and sees the state of his business — today and historical.

### Tasks

1. Auth.js v5 setup. Start with email magic links (Resend's free tier or SMTP via a free Gmail app password). One admin user = Victor's email, seeded in `.env` as `INITIAL_ADMIN_EMAIL`.

2. Route group `app/(dashboard)/` with pages:
   - `/` — Today's summary: active tickets count, today's sales, orders closed, average ticket time, last 10 orders list with drill-down.
   - `/orders` — paginated order history with filters (date range, status, search by order #).
   - `/orders/[id]` — full order detail including the raw hydrated Square order payload for debugging.
   - `/reports` — charts:
     - Sales by hour (today vs 7-day average).
     - Top 10 items by quantity this week.
     - Average ticket time trend (last 30 days).
       Use Recharts or Visx — **not** a heavy BI library.
   - `/settings/menu` — CRUD for categories/items/variations/modifiers. For MVP this edits our DB only; the Square Catalog stays source of truth until Phase 5.

3. Design: see `03-DESIGN-SYSTEM.md`. Dashboard uses the same tokens as KDS but a denser, more refined layout.

4. All metric queries live in `lib/db/queries/` with Drizzle and are fully typed. No ad-hoc SQL in route handlers.

### Exit criteria

- Victor logs in with email link.
- Dashboard shows today's real numbers from actual Square-ingested data.
- All queries p95 < 200ms with 10k orders in the DB (seed test data to confirm).

---

## Phase 5 — Two-way Square sync (menu)

Goal: edit a menu item in our admin, push the change to the Square Catalog so the POS picks it up.

This is where we start replacing Square piece by piece. Keep it small: just menu items for now.

### Tasks

1. `lib/square/menu.ts` — `pushItem(item)`, `pushCategory(cat)`, `deleteItem(id)` using the Square **Catalog API** (`upsertCatalogObject` / `batchUpsertCatalogObjects` / `deleteCatalogObject`). Remember Square's shape: an `ITEM` object nests its `ITEM_VARIATION`s (which hold `price_money`), and modifiers live in `MODIFIER_LIST`s linked to the item. Use `idempotency_key` on every write.
2. On menu save in admin, queue a BullMQ job `square.sync.item`. The job pushes and stores the returned `square_id` (and the variation ids) back on our rows. Catalog upserts return the new object **version** — persist it for the next update.
3. If Square returns an error (e.g. a version conflict), the job retries with exponential backoff, and the admin UI shows a sync status badge.
4. A "Pull from Square" button in settings runs a one-time `listCatalog` / `searchCatalogObjects` import in case someone edits in the Square dashboard or on the POS directly.

### Exit criteria

- Edit a price in our admin → change appears on the Square POS within 30 seconds.
- Deleting an item in our admin removes it from the Square Catalog.
- Editing in the Square dashboard and clicking "Pull from Square" reflects the change.

---

## Phase 6+ (backlog, NOT in scope now)

Document these in `docs/BACKLOG.md`, don't build:

- Native POS screen with Stripe Terminal SDK + BBPOS WisePad 3.
- Receipt printing via the generic ESC/POS printer (node-thermal-printer over Bluetooth).
- Customer QR-code ordering.
- Inventory tracking + low-stock alerts.
- Employee management + time tracking.
- Uber Eats / DoorDash integration.
- Kanto Fud / multi-store.
- Cross-business dashboard (pallets, mini-splits, rentals).

---

## What to do when stuck

Claude Code: if at any point a Square API behaves unexpectedly, a webhook payload doesn't match the docs, or a business rule is unclear (e.g. "what's the tax rate for a to-go order?"), **stop and ask the user**. Don't guess. A wrong tax rate costs Victor money; a wrong table name does not.

## Definition of done for the MVP

- Real Square order → card on Pi in <1s.
- Cook taps "done" → card disappears.
- Victor opens dashboard on his laptop → sees today's numbers match reality.
- Full stack runs with `docker compose up` on a fresh Mac.
- README explains how to deploy it to a mini PC later in <30 minutes.

When all five are true, MVP is done. Stop adding features. Use it for two weeks before starting Phase 5.
