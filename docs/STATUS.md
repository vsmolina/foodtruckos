# Status — where things stand (paused 2026-10-12)

Picking this up later? Read this first, then the [README](../README.md).

## Done

Phases 1–5 of [`02-BUILD-SPEC.md`](02-BUILD-SPEC.md) are built and tested against the
Square **sandbox**:

- Square webhooks → orders, payments and kitchen tickets (out-of-order and concurrent
  webhook bugs fixed).
- Kitchen Display (`/kds`) — live over Socket.IO.
- Dashboard — Today, Orders, Order detail, Reports, Menu editor; email + password login.
- Two-way Square menu sync — saves push to the Catalog (queue, retries, badges);
  "Pull from Square" imports; production pushes blocked until a first pull.
- `docker compose up` works on a fresh machine; README covers dev, config and the
  mini-PC deploy; follow-up ideas in [`BACKLOG.md`](BACKLOG.md).

### Session 2026-10-12 — KDS on the Pi + redesign

Tested on the real Raspberry Pi with a sandbox "lunch rush". Committed locally
(`a842905`), not pushed yet:

- **Pi works.** `next.config.ts` now allows the Mac's LAN IPs as `allowedDevOrigins`
  (the Pi showed "Offline" without it) and hides the Next dev indicator.
- **KDS redesign** (light theme, built from a kitchen-display research write-up:
  https://claude.ai/code/artifact/66dac676-b78d-4d3c-9eac-9a6e02c5e49d):
  - Tap a card → it lifts and arms; second tap or 1.5 s auto-confirms. Cancel / ✓ Done
    buttons on the armed card. Several armed cards each clear on their own countdown.
    Scrolling/dragging an armed card pauses its countdown. The old confirm modal is gone.
  - Long orders become tall cards (2 rows) and scroll inside; "+N more waiting" tile.
  - Modifiers tagged **NO** (red) / **ADD**, **EXTRA** (blue); notes in yellow;
    allergy notes get a red banner (`lib/kds/modifiers.ts`).
  - Slow (3 min, amber) / Late (7 min, red, pulses 3× then holds) — `lib/kds/tiers.ts`.
  - **Recent** panel → "Bring back" recalls a finished ticket with its original time.
  - A− / A+ text size on the footer (saved per screen).
  - Burger favicon (`app/icon.svg`) instead of the Next logo.
- **Dashboard redesign** with the same rules: Today compares against the same weekday
  last week up to now; tiles for Sales, Orders, Avg ticket time, In the kitchen now;
  orders tables show what was ordered and kitchen time with Slow/Late pills; Reports
  ticket-time chart has 3 / 7 min reference lines.
- **`pnpm --filter web square:sandbox-rush [min] [minGap] [maxGap]`** — rings up random
  sandbox orders (with modifiers, notes, allergies) to exercise the KDS. Sandbox only.
- Sandbox data: ~150 test orders from the rush are in the local database.

### 2026-10-12 — customer website (`apps/site`) — committed on `feat/customer-site` (af02b41)

Built all 7 phases of the Barrio Burger Co. website in `apps/site` (see
`apps/site/README.md`, `PLAN.md`, `design/DESIGN.md`). Square is the bridge:
web orders are Square orders, so they reach the KDS with no KDS changes;
foodtruck-os now moves the PICKUP fulfillment (RESERVED on ticket, PREPARED on
done) and serves `GET /api/public/kitchen` for the wait estimate. Verified on
the Square sandbox end to end. Owner inputs still needed: flyers, logo, photos,
story copy, real hours/partners, Stripe/Twilio/Resend/Neon/Vercel accounts, legal
review. Local: `pnpm --filter site dev` → http://localhost:3020 (admin password
in `apps/site/.env` comment).

### 2026-10-13 — dashboard **Website** tabs — UNCOMMITTED

The dashboard (`apps/web`) now has a Website section (`/website/*`) with tabs:
Status, Menu extras, Specials, Merch (create products with photos/variants,
orders), Gallery, Partners (+ printable QR), Catering, Subscribers (CSV,
broadcasts), Web orders & traffic; plus a Website card on Today. It calls the
site's admin API server-to-server — `POST {SITE_URL}/api/admin/v1/<op>`,
bearer `SITE_ADMIN_API_TOKEN` (same value in root `.env` and `apps/site/.env`).
Types-only contract: `packages/site-contract`. Logic is in
`apps/site/lib/admin/*`, shared with the site's own `/admin` (still works,
e.g. when the truck PC is off). After a Square menu push the dashboard asks
the site to re-sync its menu (debounced 5 s). The dashboard shell is now
responsive (top nav on phones). Verified: both apps typecheck, lint and build;
every tab driven end to end in a browser at 1280 and 390 px. Not yet tested:
the Docker image build (Dockerfile now copies the contract package manifest).

## Where the code is

- Branch **`feat/phase-4-dashboard`**, pushed to GitHub up to `b017dc7`; the
  2026-10-12 commits are local — `git push` them.
- `main` on GitHub is still the end of Phase 2 — **the PR has not been opened yet**.
  Open it here, using the description at the bottom:
  https://github.com/vsmolina/foodtruckos/compare/main...feat/phase-4-dashboard?expand=1
- Title: `Phases 3–5: KDS, dashboard, Square menu sync, Docker + docs`

## How to start it again (this Mac)

```bash
cd foodtruck-os
docker compose -f infra/docker-compose.yml -f infra/docker-compose.ports.yml up -d postgres redis
pnpm dev                     # hot reload; .env is loaded automatically
```

On this Mac `.env` has `PORT=3010`, because the host Cloudflare tunnel sends the
public webhook hostname to `localhost:3010`. Check `curl localhost:3010/api/health`.
Pi kiosk: `apps/web/scripts/pi-kiosk-setup.sh <mac-lan-ip> <store-id> 3010` (Mac is
`192.168.1.88` on the home Wi-Fi). If CSS changes don't show, restart `pnpm dev`.

## Next steps (in order)

1. **Push the 2026-10-12 commits** and run the e2e suite against a prod build
   (`tests/e2e/kds.spec.ts` was updated for arm/auto-confirm/recall but **not run**).
2. **Update `docs/03-DESIGN-SYSTEM.md`** — it still says the KDS is dark, lists the old
   colours and describes the removed confirm modal.
3. **Open and merge the PR** (link above).
4. **Automatic menu pull from Square** (not built): subscribe to
   `catalog.version.updated` (add it to `EVENT_TYPES` in
   `scripts/register-square-webhook.ts`), handle it in
   `app/api/webhooks/square/route.ts` by queueing a debounced (~10 s) `pullCatalog()`
   that waits while local pushes are pending; show "Updated from Square N min ago" on
   the Menu page. Test on sandbox first.
5. **Square POS check:** change a price in Menu → it shows on the POS device. Confirm
   with Victor that the POS rings up **itemized** orders (custom amounts arrive with no items).
6. **Real menu:** enter Victor's real items in the Square dashboard.
7. **Go live on the truck's mini PC** (README → "Deploy to the truck's mini PC"), with a
   clean database — not this Mac's sandbox data:
   - `.env`: `SQUARE_ENVIRONMENT=production`, production `SQUARE_ACCESS_TOKEN`,
     `SQUARE_APPLICATION_ID`, `SQUARE_LOCATION_ID` (`pnpm --filter web square:locations`).
   - **Pull from Square first** (production pushes are blocked until then).
   - Production webhook subscription → `https://foodtruck.matmx.com.mx/api/webhooks/square`
     (must equal `SQUARE_WEBHOOK_NOTIFICATION_URL` exactly), events `order.created`,
     `order.updated`, `order.fulfillment.updated`, `payment.created`, `payment.updated`;
     signature key → `SQUARE_WEBHOOK_SIGNATURE_KEY`. Restart.
   - Re-point the Cloudflare tunnel hostname from this Mac to the mini PC.
   - Point the Pi at the mini PC; ring a $1 real order end to end, then refund it.
8. **Use it for two weeks** before any new features; then pick Phase 6 from
   [`BACKLOG.md`](BACKLOG.md).

## Gotchas to remember

- Menu sync is **last-write-wins** — after editing on the POS/Square dashboard, Pull first.
- Dev memory runaway was Turbopack's persistent cache (disabled in `next.config.ts`); if
  it ever recurs, `rm -rf apps/web/.next/dev`.
- `next build` breaks if `NODE_ENV=development` leaks in (e.g. a sourced `.env`).
- Leave `AUTH_URL` blank to log in from other devices on the LAN.
- The repo is **public**: never commit `.env`. Commit author email is visible — GitHub
  Settings → Emails → "Keep my email addresses private" to hide it going forward.

---

## Pending PR description

> ## Summary
>
> Brings `main` up to the end of Phase 5: the Kitchen Display, the owner dashboard,
> two-way Square menu sync, and a working Docker stack + docs.
>
> - **Phase 3 — KDS** (`/kds`): Socket.IO board fed by Redis; webhook → ticket on
>   screen; tap to complete.
> - **Phase 4 — Dashboard**: email + password login (single admin); Today metrics,
>   `/orders` (filters, pagination), `/orders/[id]` (incl. raw Square payload),
>   `/reports` (Recharts), `/settings/menu` (menu CRUD).
> - **Phase 5 — Square menu sync**: saves push to the Square Catalog via a BullMQ queue
>   (retries with backoff, sync badges, Retry); "Pull from Square" import; pushes to a
>   _production_ catalog are refused until a pull has run once.
> - **Fixes found while testing**: out-of-order / concurrent Square webhooks; Turbopack
>   dev memory runaway (vercel/next.js#94915); Docker stack rebuilt so
>   `docker compose up` works on a fresh machine.
> - **Docs**: README rewritten; `docs/BACKLOG.md`; `docs/STATUS.md`.
>
> ## Migrations
>
> `0002` (users.password_hash) and `0003` (Square version + sync status columns,
> stores.catalog_pulled_at). Both additive; they run automatically on container start.
>
> ## Test plan
>
> - [x] Square sandbox: real orders → webhooks via tunnel → order, payment, ticket stored
> - [x] Concurrency: 5 parallel ingests of one order → 0 failures (4 without the fix)
> - [x] `/orders`, `/reports`: 10k synthetic orders, p95 ≤ 30 ms; chart numbers match SQL
> - [x] `/settings/menu`: full CRUD; server-side validation; forged cookie → /login
> - [x] Menu sync: price edit reached Square in 0.7 s (spec: 30 s); delete; Pull;
>       forced error → retries → Sync failed → Retry; 9/9 items identical
> - [x] Docker from scratch: builds (no `.env` inside); webhook → live ticket; LAN login
> - [ ] Price change visible on a physical Square POS
> - [ ] KDS on the Raspberry Pi with a real order
> - [ ] Production cut-over: real menu in Square → Pull → production credentials
>
> 🤖 Generated with [Claude Code](https://claude.com/claude-code)
