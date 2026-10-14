# Status — where things stand (updated 2026-10-14)

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

Tested on the real Raspberry Pi with a sandbox "lunch rush" (`a842905`):

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

### 2026-10-13 — dashboard **Website** tabs — committed on `feat/customer-site` (c0ba366)

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

### 2026-10-13 — Instagram posts on the gallery page — committed on `feat/customer-site`

`/gallery` shows the owner's 3 latest Instagram posts as Instagram embeds.
Connect once (paste a token) in the dashboard (Website → Gallery) or the site's
`/admin/gallery`; steps are in `apps/site/README.md` → "Instagram posts on the
gallery page".
- Code: `apps/site/lib/instagram.ts`, migration `0001_instagram`, new ops
  `gallery.instagram*`.
- The token renews weekly. Only post ids and links are stored. Refreshes run
  after views and from a daily cron (`vercel.json`, needs `CRON_SECRET`).
- **oEmbed:** the Meta app id and client token are in the local
  `apps/site/.env`, and must also be set in Vercel. Meta answers "(#10) must be
  reviewed": submit **Meta oEmbed Read** for App Review. Until then the
  standard embed code is used, and the site switches over automatically.
- The `INSTAGRAM_EMBED_POST_URLS` setting was replaced by this.
- Verified: a local mock of the Instagram API, plus a real public post
  rendering through Instagram's embed.js at 390 and 1280 px.
- **Not yet tried with the owner's real account**: needs the account token.

## Where the code is

- Everything is on **`main`**: PR #1 (https://github.com/vsmolina/foodtruckos/pull/1)
  merged `feat/customer-site`, covering Phases 3–5 and everything since.
- Checked before merging (2026-10-14): KDS e2e suite passes against a production
  build (3/3); the Docker image builds and starts (migrations run, `/api/health`
  reports db and redis ok); `docs/03-DESIGN-SYSTEM.md` describes the light KDS.

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

1. **Owner setup for the website** (`apps/site/README.md`): connect Instagram
   (Website → Gallery), submit "Meta oEmbed Read" for App Review, create the
   Vercel / Neon / Stripe / Twilio / Resend accounts and set the env vars
   (incl. `CRON_SECRET`, `INSTAGRAM_APP_ID`, `INSTAGRAM_CLIENT_TOKEN`); logo,
   photos, story copy, real hours and partners; legal review.
2. **Automatic menu pull from Square** (not built): subscribe to
   `catalog.version.updated` (add it to `EVENT_TYPES` in
   `scripts/register-square-webhook.ts`), handle it in
   `app/api/webhooks/square/route.ts` by queueing a debounced (~10 s) `pullCatalog()`
   that waits while local pushes are pending; show "Updated from Square N min ago" on
   the Menu page. Test on sandbox first.
3. **Square POS check:** change a price in Menu → it shows on the POS device. Confirm
   with Victor that the POS rings up **itemized** orders (custom amounts arrive with no items).
4. **Real menu:** enter Victor's real items in the Square dashboard.
5. **Go live on the truck's mini PC** (README → "Deploy to the truck's mini PC"), with a
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
6. **Use it for two weeks** before any new features; then pick Phase 6 from
   [`BACKLOG.md`](BACKLOG.md).

## Gotchas to remember

- Menu sync is **last-write-wins** — after editing on the POS/Square dashboard, Pull first.
- Dev memory runaway was Turbopack's persistent cache (disabled in `next.config.ts`); if
  it ever recurs, `rm -rf apps/web/.next/dev`.
- `next build` breaks if `NODE_ENV=development` leaks in (e.g. a sourced `.env`).
- Leave `AUTH_URL` blank to log in from other devices on the LAN.
- The repo is **public**: never commit `.env`. Commit author email is visible — GitHub
  Settings → Emails → "Keep my email addresses private" to hide it going forward.

