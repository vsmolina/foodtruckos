# foodtruck-os

A self-hosted operating system for Victor's food truck. It takes orders from
**Square** (webhooks), shows them on a **Kitchen Display** (a Raspberry Pi by the
grill), and gives Victor a **dashboard** for sales, orders, reports and the menu —
with menu edits synced back to Square. Square stays the system of record for
payments; we wrap it and replace pieces over time (Strangler Fig).

| Where                     | What                                                             |
| ------------------------- | ---------------------------------------------------------------- |
| `/kds?store=<id>`         | Kitchen display — live tickets, tap to complete. Truck LAN only. |
| `/`                       | Today: active tickets, sales, orders closed, avg ticket time     |
| `/orders`, `/orders/<id>` | Order history with filters; full detail incl. raw Square payload |
| `/reports`                | Sales by hour, top items, ticket-time trend                      |
| `/settings/menu`          | Menu editor, synced to the Square Catalog; "Pull from Square"    |
| `/api/webhooks/square`    | Square webhook endpoint (signature-verified)                     |
| `/api/health`             | DB + Redis health check                                          |

Everything except the KDS needs the admin login. Phases 1–5 of
[`docs/02-BUILD-SPEC.md`](docs/02-BUILD-SPEC.md) are built; ideas beyond that live in
[`docs/BACKLOG.md`](docs/BACKLOG.md).

---

## Quick start (Mac, development)

You need Node 22, pnpm 10 (`corepack enable`), and Docker Desktop. Brand-new machine
or no Square account yet? Do [`docs/00-PREFLIGHT.md`](docs/00-PREFLIGHT.md) first.

```bash
git clone <repo> foodtruck-os && cd foodtruck-os
pnpm install
cp .env.example .env            # then fill in — see "Configuration" below
```

Pick **one** way to run it:

**A. App on the Mac, data in Docker** (fastest edit loop):

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.ports.yml up -d postgres redis
pnpm --filter web db:migrate
pnpm --filter web db:seed                    # fresh DB only: demo store + placeholder menu
pnpm --filter web admin:set-password you@example.com 'a-long-password'
pnpm dev                                     # http://localhost:3000 (PORT in .env)
```

**B. Everything in Docker** (what a fresh machine does):

```bash
# needs INITIAL_ADMIN_EMAIL + INITIAL_ADMIN_PASSWORD in .env for the first login
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up
```

The dev overlay mounts the repo and hot-reloads; on an empty database it seeds the
demo menu and creates the admin login. Open http://localhost:3000.

Scripts read the repo-root `.env` themselves — no `source .env` needed.

---

## Configuration (`.env`)

Copy [`.env.example`](.env.example); each variable is documented there. The ones
that matter:

| Variable                                       | Notes                                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| `AUTH_SECRET`                                  | Required. `openssl rand -base64 32`                                                 |
| `AUTH_URL`                                     | Leave **blank** — login then works on localhost, the LAN IP and the tunnel alike    |
| `INITIAL_ADMIN_EMAIL`                          | The one admin who can sign in                                                       |
| `INITIAL_ADMIN_PASSWORD`                       | First-login password for Docker installs (never overwrites an existing one)         |
| `PORT`                                         | App port when running on the host (default 3000)                                    |
| `DATABASE_URL`, `REDIS_URL`                    | Host dev: `localhost:5433` / `localhost:6380` (ports overlay). Docker sets its own. |
| `SQUARE_ENVIRONMENT`                           | `sandbox` or `production`                                                           |
| `SQUARE_ACCESS_TOKEN`, `SQUARE_APPLICATION_ID` | From the Square Developer Dashboard                                                 |
| `SQUARE_LOCATION_ID`                           | `pnpm --filter web square:locations` lists them                                     |
| `SQUARE_WEBHOOK_SIGNATURE_KEY`                 | From the webhook subscription                                                       |
| `SQUARE_WEBHOOK_NOTIFICATION_URL`              | Must **exactly** match the subscription URL (it's part of the signature)            |
| `CLOUDFLARE_TUNNEL_TOKEN`                      | Only for the tunnel container (`--profile tunnel`)                                  |
| `SQUARE_MOCK=1`                                | Offline mode: fake Square hydration, menu sync off                                  |

---

## Square

- **Orders**: Square sends webhooks to `/api/webhooks/square`; each order is fetched
  from the Orders API, stored, and pushed to the KDS. Setup, sandbox orders and an
  offline mock are in [`docs/TESTING.md`](docs/TESTING.md).
- **Menu sync** (Phase 5): saving in `/settings/menu` queues a push to the Square
  Catalog (badge shows _Syncing… → In Square_; failures retry ~1 min, then _Sync
  failed_ with Square's message and a Retry button).
  - **Square doesn't detect conflicting edits — the last save wins.** If someone
    edits on the POS or in the Square dashboard, click **Pull from Square** first.
  - **Production guard:** pushes to a _production_ catalog are refused until a Pull
    has run once, so the placeholder demo menu can never overwrite the real one.

---

## Deploy to the truck's mini PC (~30 min)

The mini PC runs the whole stack in Docker; the Pi shows the KDS from it over the
truck LAN; Square reaches it through a Cloudflare Tunnel.

1. **Install Docker** on the mini PC (Docker Desktop on macOS/Windows, Docker Engine
   on Linux) and `git`. Give it a fixed LAN IP in the router (e.g. `192.168.1.50`).
2. **Get the code and config:**
   ```bash
   git clone <repo> foodtruck-os && cd foodtruck-os
   cp .env.example .env
   ```
   Fill in `AUTH_SECRET`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, and the
   **production** Square values (`SQUARE_ENVIRONMENT=production`, token, location,
   app id). Leave `AUTH_URL` and `SEED_DEMO_MENU` blank.
3. **Start it** (first build ~2–3 min):
   ```bash
   docker compose -f infra/docker-compose.yml --profile tunnel up -d --build
   ```
   Drop `--profile tunnel` if the tunnel runs as a host service instead (see step
   5). Without `WEB_PORT` it listens on 3000; `WEB_PORT=3010 docker compose …` to
   change it. Migrations, the store record and the admin login are created
   automatically. Check: `curl http://localhost:3000/api/health`.
4. **Sign in** at `http://<mini-pc-ip>:3000` → **Menu → Pull from Square**. This
   imports the real menu and unlocks menu pushes.
5. **Webhooks:** route the public hostname to the app — with the tunnel container,
   point the hostname at `http://web:3000` in Cloudflare Zero Trust; with a host
   `cloudflared`, at `http://localhost:<WEB_PORT>`. Then register the webhook (or use
   the Square dashboard) and copy the signature key into `.env`:
   ```bash
   docker compose -f infra/docker-compose.yml exec -w /app/apps/web web ./node_modules/.bin/tsx scripts/register-square-webhook.ts
   docker compose -f infra/docker-compose.yml up -d     # restart with the new key
   ```
   `SQUARE_WEBHOOK_NOTIFICATION_URL` must be exactly `https://<hostname>/api/webhooks/square`.
6. **Kitchen display:** on the Pi, run
   [`apps/web/scripts/pi-kiosk-setup.sh`](apps/web/scripts/pi-kiosk-setup.sh)
   `<mini-pc-ip> <store-id> 3000`. Get the store id with:
   ```bash
   docker compose -f infra/docker-compose.yml exec postgres psql -U foodtruck -tAc "select id from stores"
   ```
7. **Test end to end:** ring up a small order on the Square POS → the ticket appears
   on the Pi within a second → tap it done → it's on the dashboard.

**Updating:** `git pull && docker compose -f infra/docker-compose.yml --profile tunnel up -d --build`
(migrations run on start).

**Backups** (run nightly from cron or a scheduled task):

```bash
docker compose -f infra/docker-compose.yml exec -T postgres pg_dump -U foodtruck foodtruck | gzip > backup-$(date +%F).sql.gz
```

**Change the admin password:**
`docker compose -f infra/docker-compose.yml exec -w /app/apps/web web ./node_modules/.bin/tsx scripts/set-admin-password.ts <email> '<new password>'`

---

## Commands

```bash
pnpm dev                 # custom server (Next + Socket.IO + sync worker), hot reload
pnpm build && pnpm start # production build + server
pnpm lint
pnpm test                # Playwright KDS end-to-end (needs Postgres + Redis; see docs/TESTING.md)
pnpm format              # prettier --write

pnpm --filter web db:generate             # new migration after editing lib/db/schema.ts
pnpm --filter web db:migrate
pnpm --filter web db:seed                 # fresh DB only: recreates store + placeholder menu
pnpm --filter web admin:set-password <email> <password>
pnpm --filter web square:locations        # list Square location ids
pnpm --filter web square:sandbox-order    # ring up a real sandbox order (fires webhooks)
pnpm --filter web mock:square             # signed fake webhook, for SQUARE_MOCK=1
```

## Troubleshooting

- **Dev server memory keeps climbing / "JavaScript heap out of memory"** — Turbopack's
  persistent dev cache (a Next 16.2 bug). It's disabled in `next.config.ts`; if it
  happens anyway, `rm -rf apps/web/.next/dev`. Details in `docs/TESTING.md`.
- **`next build` fails with `Cannot read properties of null (reading 'useContext')`** —
  `NODE_ENV=development` leaked into the build (e.g. from a sourced `.env`). Build
  with `NODE_ENV=production` or without sourcing `.env`.
- **KDS says "available on the local network only"** — by design; it only answers
  LAN addresses, never the public tunnel.
- **Menu item stuck on "Sync failed"** — hover the badge or open the item for Square's
  error; fix it and press Retry. Edited in Square meanwhile? Pull from Square.
- **Port already in use** — change `PORT` (host) or `WEB_PORT` (Docker), and the
  Postgres/Redis host ports via `POSTGRES_HOST_PORT` / `REDIS_HOST_PORT`.

## Layout

```
foodtruck-os/
├── apps/web/          # the Next.js app: KDS, dashboard, menu admin, webhooks
│   ├── server.ts      # custom server: Next + Socket.IO + Square sync worker
│   ├── app/           # routes (dashboard, kds, login, api)
│   ├── lib/           # db (Drizzle schema, queries), square, queue, kds, auth
│   ├── drizzle/       # SQL migrations
│   └── scripts/       # admin, bootstrap, Square and Pi helpers
├── docs/              # preflight, architecture, build spec, design system, testing, backlog
└── infra/             # Dockerfile, compose files, entrypoint
```

## Conventions

- **Money is integer cents**, never floats. Times are UTC in the DB; the local
  timezone (`America/Chicago`) only at the UI edge.
- TypeScript strict, no `any`. Secrets live in `.env`, never committed.
  Conventional Commits. Every feature gets at least one test.

Design docs, in order: [`01-ARCHITECTURE`](docs/01-ARCHITECTURE.md) ·
[`02-BUILD-SPEC`](docs/02-BUILD-SPEC.md) · [`03-DESIGN-SYSTEM`](docs/03-DESIGN-SYSTEM.md) ·
[`TESTING`](docs/TESTING.md)
