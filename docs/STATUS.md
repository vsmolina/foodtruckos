# Status — where things stand (paused 2026-10-06)

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

## Where the code is

- All work is on branch **`feat/phase-4-dashboard`**, pushed to GitHub. `main` on
  GitHub is still the end of Phase 2 — **the PR has not been opened yet** (14
  commits: Phase 3 KDS, Phase 4, Phase 5, Docker + docs).
- Open it here, using the description below:
  https://github.com/vsmolina/foodtruckos/compare/main...feat/phase-4-dashboard?expand=1
- Title: `Phases 3–5: KDS, dashboard, Square menu sync, Docker + docs`

## State of the data (sandbox)

- Local menu = the **placeholder** seed menu (9 items, 4 categories). It has been pushed
  to the Square sandbox catalog, so both sides match (verified item by item).
- No orders in the database (test orders were cleared).
- The admin login exists (`INITIAL_ADMIN_EMAIL`); reset it with
  `pnpm --filter web admin:set-password <email> <password>` if forgotten.

## How to start it again (this Mac)

```bash
cd foodtruck-os
docker compose -f infra/docker-compose.yml -f infra/docker-compose.ports.yml up -d postgres redis
pnpm dev                     # hot reload; .env is loaded automatically
```

On this Mac `.env` has `PORT=3010`, because the host Cloudflare tunnel sends the
public webhook hostname to `localhost:3010`. Check `curl localhost:3010/api/health`.

## Next steps (in order)

1. **Open and merge the PR** (link above).
2. **Hardware checks** (the MVP items not verifiable without devices):
   - Pi: `apps/web/scripts/pi-kiosk-setup.sh <mac-lan-ip> <store-id> 3010`, then
     `pnpm --filter web square:sandbox-order` → ticket on the Pi in < 1 s → tap done.
   - Square POS: change a price in Menu → it shows on the POS device.
3. **Real menu:** enter Victor's real items in the Square dashboard → **Pull from Square**
   (replaces the placeholders).
4. **Go live:** README → "Deploy to the truck's mini PC". Production credentials,
   **Pull from Square first**, register the production webhook, one real order end to end.
5. **Use it for two weeks** before any new features; then pick Phase 6 from
   [`BACKLOG.md`](BACKLOG.md). Suggested first fix: "Orders closed" should count
   kitchen-finished tickets (Square closes orders the moment they're paid).

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
