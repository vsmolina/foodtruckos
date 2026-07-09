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

Ring up an itemized order in the Square sandbox seller dashboard (or via
`CreateOrder` + `CreatePayment` sandbox API calls). Watch the app logs and
confirm the same rows/Redis message as in the mock flow. The Dashboard's
**Send Test Event** button on the subscription is a quick smoke test.
