# Testing — Square webhook ingestion (Phase 2)

Two ways to exercise the pipeline: **offline mock** (no Square, no internet) and
**real sandbox** (Square delivers actual webhooks). Start with the mock.

All commands run from `apps/web` (or prefix with `pnpm --filter web`).

---

## A. Offline mock (no Square account needed)

The mock server stubs Square's order hydration from a fixture, so you can drive
the full webhook → hydrate → DB → Redis flow locally.

1. Start Postgres + Redis (from repo root). Publish alt host ports if 5432/6379
   are taken:

   ```bash
   docker compose -f infra/docker-compose.yml up -d postgres redis
   ```

2. Migrate + seed:

   ```bash
   DATABASE_URL=postgresql://foodtruck:foodtruck@localhost:5432/foodtruck \
   pnpm --filter web db:migrate && pnpm --filter web db:seed
   ```

3. Run the app in **mock mode** — `SQUARE_MOCK=1` makes `retrieveOrder()` return
   a fixture instead of calling Square. Pick any dev signature key:

   ```bash
   SQUARE_MOCK=1 \
   SQUARE_WEBHOOK_SIGNATURE_KEY=devkey \
   SQUARE_WEBHOOK_NOTIFICATION_URL=http://localhost:3000/api/webhooks/square \
   DATABASE_URL=postgresql://foodtruck:foodtruck@localhost:5432/foodtruck \
   REDIS_URL=redis://localhost:6379 \
   pnpm --filter web dev
   ```

4. Fire a correctly-signed `order.created` at it:

   ```bash
   SQUARE_WEBHOOK_SIGNATURE_KEY=devkey \
   SQUARE_WEBHOOK_NOTIFICATION_URL=http://localhost:3000/api/webhooks/square \
   pnpm --filter web mock:square
   # → order.created order=MOCK-... -> 200 {"ok":true}
   ```

   `MOCK_EVENT_TYPE=order.updated` sends an update instead.

5. Confirm the effects:

   ```bash
   # Rows created
   psql "$DATABASE_URL" -c "select square_order_id, status, total_cents from orders;"
   psql "$DATABASE_URL" -c "select name_snapshot, qty, unit_price_cents from order_items;"
   psql "$DATABASE_URL" -c "select state from kitchen_tickets;"

   # Redis event (run before firing, in another terminal)
   redis-cli psubscribe 'kds:store:*'
   ```

### What to assert (Phase 2 exit criteria)

- A `MOCK-…` order appears in `orders` with hydrated `order_items` (+ modifiers)
  and one `kitchen_tickets` row.
- Firing the **same `event_id`** twice returns `{"duplicate":true}` and does not
  create duplicate rows (the mock randomizes ids each run; reuse a fixed payload
  to test this, or re-send the same `order_id` — the `square_version` guard also
  blocks stale updates).
- A **bad signature** returns `401` and writes a `webhook_events` row with
  `signature_valid = false`.
- `redis-cli psubscribe 'kds:store:*'` receives a `ticket:created` message.

---

## A2. KDS end-to-end (Playwright)

`apps/web/tests/e2e/kds.spec.ts` drives the whole live path in a real browser:
fire a signed `order.created` → ingest → DB → Redis → Socket.IO → the ticket
renders on the board → tap → confirm → it clears. A second test fast-forwards the
board clock to assert the 3-minute amber tier.

```bash
pnpm --filter web test:e2e
```

Playwright starts its own web server on port `3100` (`KDS_TEST_PORT`) in
`SQUARE_MOCK=1` mode, so no Square account or network is needed. It still needs a
live, migrated + seeded Postgres and Redis.

**Two things to know:**

- **It builds and runs a *production* server, not `dev`.** The
  `webServer.command` is `next build && tsx server.ts` (first run pays the ~15s
  build; `reuseExistingServer` skips it locally on re-runs), so the test runs
  the same code path as the truck.

  History: `dev` used to wedge with the KDS open (webhook POSTs hung) and once
  forked node processes until macOS hit its per-user process limit. Since
  `server.ts` gained graceful shutdown (it releases the port, Socket.IO, Redis
  and Postgres on SIGTERM so `tsx watch` restarts don't stack servers), neither
  reproduces: re-checked 2026-10-03 with Chrome on `/kds`, `[HMR] connected`,
  live hot reload, `tsx watch` restarts, and three signed webhooks (all 200,
  tickets rendered live) — process count flat at 2–3. If it ever recurs, watch
  `ps -ax | grep -c node` and stop `pnpm dev` before the box runs out of
  processes.

  Separately, Turbopack's persistent dev cache (`.next/dev/cache`) made the
  dev server's memory climb ~30 MB/s while idle after the first compile, until
  "JavaScript heap out of memory" (~6 min; vercel/next.js#94915, Next 16.2.x).
  Webpack dev and a fresh cache stayed flat, so `next.config.ts` turns the
  cache off (`experimental.turbopackFileSystemCacheForDev: false`). Verified:
  all six pages compiled, then RSS flat at ~1.8 GB for 4 min. If memory climbs
  again, `rm -rf apps/web/.next/dev` and check that flag.

- **Point it at the right DB/Redis if 5432/6379 are taken.** The config defaults
  to the standard localhost ports, but `infra/docker-compose.yml` publishes
  Postgres/Redis on *ephemeral* host ports (no fixed host mapping), and another
  stack may already own 5432/6379. Check `docker ps` for the real ports and
  override:

  ```bash
  DATABASE_URL=postgresql://foodtruck:foodtruck@localhost:5433/foodtruck \
  REDIS_URL=redis://localhost:6380 \
  pnpm --filter web test:e2e
  ```

---

## B. Real Square sandbox

### 1. Get your Location ID

```bash
SQUARE_ACCESS_TOKEN=... SQUARE_ENVIRONMENT=sandbox pnpm --filter web square:locations
```

Copy an id (e.g. `L8N…`) into `SQUARE_LOCATION_ID` in `.env`. A Location is a
place you do business — every Square order/payment is stamped with its
`location_id`, which we map to a `stores` row.

### 2. Expose the app publicly

Square can't reach `localhost`. Use the Cloudflare Tunnel (see
`infra/docker-compose.yml`, Phase 2 task 6) or `ngrok http 3000`. Note the public
HTTPS URL — your webhook endpoint is `<public-url>/api/webhooks/square`.

Set `SQUARE_WEBHOOK_NOTIFICATION_URL` in `.env` to **exactly** that URL — it is
part of the signature and must match on both ends.

### 3. Create the webhook subscription

**Option 1 — Developer Dashboard:** developer.squareup.com/apps → your app →
(Sandbox toggle) → **Webhooks → Subscriptions → Add subscription**. Set the
Notification URL, pick an API version, and check: `order.created`,
`order.updated`, `order.fulfillment.updated`, `payment.created`,
`payment.updated`. Save, then copy the **Signature Key** into
`SQUARE_WEBHOOK_SIGNATURE_KEY`.

**Option 2 — Script** (handy for redeploys):

```bash
SQUARE_ACCESS_TOKEN=... SQUARE_ENVIRONMENT=sandbox \
SQUARE_WEBHOOK_NOTIFICATION_URL=https://<public-url>/api/webhooks/square \
pnpm --filter web square:register-webhook
```

It prints the subscription id and Signature Key — copy the key into `.env`.

### 4. Drive an order

Fastest: ring one up over the API with the sandbox test card — this fires real
`order.created` / `payment.created` / `order.updated` webhooks:

```bash
SQUARE_ACCESS_TOKEN=... SQUARE_ENVIRONMENT=sandbox SQUARE_LOCATION_ID=... \
pnpm --filter web square:sandbox-order
```

Then confirm the same rows/Redis message as in the mock flow (orders +
order_items + kitchen_ticket, and a `payments` row with the correct
`amount_cents`, linked to the order). You can also ring up an order in the
sandbox seller dashboard, or use the Dashboard's **Send Test Event** button.

> **Exposing the app:** Square needs a public HTTPS URL. If you already run a
> named Cloudflare tunnel, add an ingress rule for a subdomain
> (`foodtruck.<domain> -> http://localhost:<port>`), `cloudflared tunnel route
> dns <tunnel> foodtruck.<domain>`, and reload the connector. Set
> `SQUARE_WEBHOOK_NOTIFICATION_URL` to that URL **exactly** — it's part of the
> signature. A `trycloudflare.com` quick tunnel works too but its URL is
> ephemeral (re-register the webhook when it changes), and note that an existing
> named-tunnel `config.yml` with a `http_status:404` catch-all will 404 any
> other hostname.
