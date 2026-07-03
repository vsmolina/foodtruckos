# 01 — Architecture

This document explains **what we're building and why**. Read this before the build spec.

## The business we're solving for

Victor runs a Mexican-style burger and bacon-wrapped hot dog food truck in San Marcos, TX, operating behind a bar. Current stack: **Square** for orders, payments, and POS (recently migrated off a GoDaddy Poynt terminal), plus manual everything else. Victor also runs a pallet manufacturing cross-border operation (Juárez/El Paso), a mini-split import business, and property management — but **this project is scoped to the food truck only**. Other businesses may connect later.

> **POS platform note.** This project originally targeted GoDaddy Poynt and was retargeted to **Square**. The architecture is intentionally POS-agnostic (see the Strangler Fig section): only the ingestion layer and the `square_*` reference columns are Square-specific. Swapping the upstream POS again would not touch the KDS, dashboard, schema core, or realtime layer.

Constraints that shape the architecture:

- Food truck operates with unreliable internet (mobile hotspot, bar Wi-Fi).
- Victor is the sole operator today; employees come later. System must not require an admin to run.
- Hardware already owned: Alacrity MJ-Q50 Android handheld, generic ESC/POS Bluetooth printer, Raspberry Pi 4 with a 9"x5" touchscreen, a Mac (development + server), and the Square POS hardware (Square Register / Terminal) now running the truck.
- Budget-conscious: avoid SaaS where a self-hosted replacement costs nothing.

## What we're building

A self-hosted, single-tenant, food-truck operating system with four surfaces:

1. **POS surface** — order entry, payment, receipt printing (deferred past MVP; the current Square POS keeps doing this).
2. **Kitchen Display System (KDS)** — 4x2 grid of active orders with timers, on the Pi touchscreen.
3. **Business Dashboard** — real-time ops view + historical analytics on Victor's Mac/laptop.
4. **Admin/config** — menu, modifiers, prices, eventually employees, inventory, vendors.

## Scope: what's in v1 (MVP)

Per Victor's explicit selection:

| Surface                     | In MVP?    | Notes                                                                   |
| --------------------------- | ---------- | ----------------------------------------------------------------------- |
| Kitchen Display             | ✅ Yes     | Core of MVP. Orders flow from Square → our system → Pi.                 |
| POS order entry             | ⚠️ Partial | Square keeps taking orders; we ingest them. Our native POS comes in v2. |
| Payment + receipt           | ❌ No      | Stays on the Square POS for MVP.                                        |
| Inventory / menu management | ✅ Yes     | Read menu from Square Catalog, edit in our admin, sync back.            |
| Business dashboard          | ✅ Yes     | Sales by hour, average ticket time, top items.                          |
| Delivery integrations       | ❌ No      | Phase 3+.                                                               |
| Employee management         | ❌ No      | Phase 3+.                                                               |

## The architectural decision that matters most: ingest-first, replace-later

**We are NOT ripping out Square in MVP.** Instead:

- Square's cloud sends a webhook to our system every time an order is created, updated, fulfilled, or a payment is taken.
- Our system becomes the **system of record for kitchen operations, analytics, and eventually everything** — but Square remains the system of record for payment capture until we're ready to replace it.
- When we later want to replace Square, we swap the ingestion source (Square webhook → our own POS UI) without changing any of the downstream code. The kitchen display, the dashboard, the database all stay the same.

> **Square caveat (matters for Phase 2):** Square's `order.created` / `order.updated` webhooks are _thin_ — they carry only the order **id**, **version**, **state**, and **location_id**, not the line items or totals. The webhook handler must call the **Orders API (`RetrieveOrder`)** to hydrate the full order before upserting. `payment.*` events, by contrast, carry the full payment object.

This is called the **Strangler Fig pattern**: wrap the legacy system, slowly redirect traffic, eventually remove it. It's the difference between this project shipping in a month vs. never.

## Deployment topology

```
┌─────────────────────────────────────────────────────────────┐
│  PUBLIC INTERNET                                            │
│                                                             │
│  ┌──────────────┐        ┌─────────────────────────────┐   │
│  │ Square Cloud │───────▶│  Cloudflare Tunnel          │   │
│  │  (Orders API)│ webhook│  api.yourdomain.com         │   │
│  └──────────────┘        └──────────────┬──────────────┘   │
└─────────────────────────────────────────┼──────────────────┘
                                          │ encrypted
                                          ▼
┌─────────────────────────────────────────────────────────────┐
│  VICTOR'S MAC (the "server" for now — later: mini PC at     │
│  the truck or a Hetzner VPS)                                │
│                                                             │
│  ┌─────────── Docker Compose ────────────────────────┐     │
│  │                                                    │     │
│  │  ┌──────────────┐   ┌──────────────┐              │     │
│  │  │  Next.js app │◀─▶│  PostgreSQL  │              │     │
│  │  │  (port 3000) │   │  (port 5432) │              │     │
│  │  └──────┬───────┘   └──────────────┘              │     │
│  │         │                                          │     │
│  │         │  ┌──────────────┐                        │     │
│  │         ├─▶│  Redis       │ (pub/sub + cache)     │     │
│  │         │  └──────────────┘                        │     │
│  │         │                                          │     │
│  │         │  ┌──────────────┐                        │     │
│  │         └─▶│  cloudflared │                        │     │
│  │            └──────────────┘                        │     │
│  └────────────────────────────────────────────────────┘    │
│                           │                                 │
└───────────────────────────┼─────────────────────────────────┘
                            │ local network (Wi-Fi)
                            │ WebSocket
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
      ┌──────────┐    ┌──────────┐    ┌──────────┐
      │ Raspberry│    │ Victor's │    │  MJ-Q50  │
      │  Pi KDS  │    │ laptop   │    │ (future) │
      │ (Chrome) │    │ (Chrome) │    │          │
      └──────────┘    └──────────┘    └──────────┘
         Kitchen        Dashboard         POS
```

## The stack — and why each piece

| Layer              | Choice                                            | Why                                                                                                                                     |
| ------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **POS / payments** | Square (Orders, Catalog, Payments, Webhooks APIs) | Already the truck's live POS. We ingest its webhooks; the official `square` Node SDK handles auth, retries, and signature verification. |
| **App framework**  | Next.js 15 (App Router)                           | Server-first React, great DX, API routes collocated with UI, huge ecosystem. No need for a separate backend.                            |
| **Language**       | TypeScript (strict)                               | Catches errors at edit time; food-truck logic (prices, totals) must not have runtime surprises.                                         |
| **Database**       | PostgreSQL 16                                     | Rock-solid, free, handles everything we'll ever throw at it. JSON columns for flexible menu modifiers.                                  |
| **ORM**            | Drizzle                                           | Type-safe SQL without the Prisma overhead. Migrations are plain SQL files.                                                              |
| **Realtime**       | Socket.IO on top of Redis pub/sub                 | Kitchen display needs sub-second updates. WebSockets >> polling. Redis so we can scale to multiple app instances later.                 |
| **Cache / queue**  | Redis 7                                           | Pub/sub for realtime + BullMQ for background jobs (webhook retry, printer queue, report generation).                                    |
| **Auth**           | Auth.js (NextAuth) v5                             | Free, self-hosted, supports magic-link email for employees later.                                                                       |
| **Styling**        | Tailwind CSS v4 + CSS variables                   | See 03-DESIGN-SYSTEM.md — this is not generic Tailwind slop.                                                                            |
| **UI primitives**  | Radix UI (headless)                               | Accessible primitives we style ourselves. No shadcn template soup.                                                                      |
| **Forms**          | React Hook Form + Zod                             | Zod schemas double as API validators. One source of truth.                                                                              |
| **Testing**        | Vitest + Playwright                               | Unit + E2E. KDS-critical flows get E2E tests.                                                                                           |
| **Container**      | Docker + Docker Compose                           | One `docker compose up` starts everything. Reproducible across Victor's Mac, a mini PC, or a cloud VPS.                                 |
| **Public ingress** | Cloudflare Tunnel                                 | Free, no router config, survives ISP IP changes, gives us HTTPS.                                                                        |
| **Observability**  | Pino logs + a single Grafana dashboard            | Free, self-hosted. Postponed to Phase 2 — MVP uses console logs.                                                                        |

## Data model (MVP — will grow)

Core entities, designed to map cleanly to Square's Orders + Catalog model so ingestion is a thin translation layer:

```
Business (1)  -- maps to a Square merchant
 └── Stores (n)  -- maps to Square locations
      └── Menu
           └── Categories (n)            -- Square CatalogCategory
                └── Items (n)            -- Square CatalogItem
                     └── Variations (n)  -- Square ItemVariation (carries the PRICE)
                          └── Modifiers (n) -- Square CatalogModifier (via ModifierList)
      └── Orders (n)
           ├── OrderItems (n)            -- Square order line_items
           │    └── OrderItemModifiers (n)
           ├── Payments (n)              -- from Square payment.* webhooks, read-only in MVP
           └── KitchenTicket (1)         -- our addition: the timer, station, state
      └── Employees (n)                  -- empty in MVP, structure exists
      └── Shifts (n)                     -- empty in MVP
```

> **Catalog shape difference vs. Poynt:** in Square the **price lives on the item _variation_, not the item**. A plain burger is an Item with one default Variation; a burger with sizes is one Item with several Variations. The schema reflects this with a `menu_item_variations` table (see build spec Phase 1).

Every entity has: `id` (UUID v7 for time-orderable PKs), `created_at`, `updated_at`, `deleted_at` (soft delete), and an optional `square_id` reference for anything that came from Square.

## Realtime event flow (the KDS path)

1. Customer orders at the Square POS (Square Register / Terminal / Square for Restaurants). Cashier sends the order.
2. Square cloud fires webhook `order.created` to `https://api.yourdomain.com/api/webhooks/square`. **This webhook is thin — it carries only the order id + version + location.**
3. Our webhook handler:
   - Verifies the webhook signature (HMAC-SHA256 over `notificationUrl + rawBody`, compared to the `x-square-hmacsha256-signature` header).
   - **Hydrates the order** by calling Square `RetrieveOrder(order_id)` to get line items, modifiers, and totals.
   - Upserts the order into Postgres (idempotent — same order/version delivered twice = no duplicate).
   - Creates a `KitchenTicket` row with `state=pending`, `started_at=now()`.
   - Publishes to Redis channel `kds:store:<store_id>` with the new ticket payload.
   - Returns HTTP 200 within 2 seconds (Square retries failed deliveries with backoff).
4. The Next.js Socket.IO server subscribes to Redis `kds:store:*` and broadcasts to all connected KDS clients in that store's room.
5. The Pi's browser is connected to Socket.IO; it receives the event and appends the order to the 4x2 grid. Timer starts from `started_at`.
6. When cook taps the order card:
   - Client sends `ticket:complete` with ticket ID.
   - Server verifies the user (or unauthenticated-but-local-network for MVP) and updates `KitchenTicket.state=done`, `completed_at=now()`.
   - Publishes the removal so all connected displays drop it.
   - **(v2)** Calls Square Orders API to update the order's fulfillment state to `COMPLETED`.

## What we defer (and when to revisit)

| Deferred                             | Revisit when                                   |
| ------------------------------------ | ---------------------------------------------- |
| Native POS (replace Square checkout) | MVP runs for 2+ weeks with no kitchen issues.  |
| Customer-facing order app            | Delivery/QR-code orders become a revenue goal. |
| Multi-truck / multi-store            | Victor opens truck #2 or Kanto Fud goes live.  |
| Employee clock-in, payroll           | First hire.                                    |
| Inventory depletion tracking         | Food cost becomes a concern worth automating.  |
| Full accounting replacement          | CONTPAQi / Square sync becomes painful.        |
| Mobile app                           | Browser PWA isn't enough. Probably never.      |

## Non-functional requirements

- **Offline tolerance.** KDS must keep working for at least 10 minutes with no internet. Orders queued during an outage are reconciled when Square redelivers the missed webhooks (Square retries with backoff for ~72h; a periodic `listOrders` sweep is the backstop).
- **Data durability.** Daily Postgres backups to encrypted S3-compatible storage (Cloudflare R2 — $0.015/GB). Point-in-time recovery via WAL archiving.
- **Security.** Webhook signatures verified. Admin routes behind auth. Secrets in `.env`, never committed. HTTPS everywhere via Cloudflare.
- **Recovery.** If Victor's Mac dies, a new machine with Docker + the repo + a Postgres backup is running again in <1 hour.
- **Performance.** KDS update latency p95 < 500ms from "order sent at the Square POS" to "appears on Pi" (includes the Square `RetrieveOrder` hydration call). Dashboard queries p95 < 200ms.

## Repo layout

```
foodtruck-os/
├── docs/                       # these files
├── apps/
│   └── web/                    # the Next.js app (POS, KDS, dashboard, admin — all in one)
│       ├── app/
│       │   ├── (dashboard)/    # owner's analytics UI
│       │   ├── (admin)/        # menu/config
│       │   ├── kds/            # kitchen display — no chrome, full screen
│       │   ├── pos/            # native POS — Phase 3
│       │   └── api/
│       │       ├── webhooks/square/
│       │       ├── realtime/   # Socket.IO handler
│       │       └── trpc/       # or REST — TBD in build spec
│       ├── components/
│       ├── lib/
│       │   ├── db/             # Drizzle schema + queries
│       │   ├── square/         # API client + webhook verification
│       │   ├── realtime/       # Socket.IO server + Redis pub/sub
│       │   └── design/         # design tokens
│       └── tests/
├── packages/
│   └── shared/                 # types shared across apps if we split later
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   ├── Dockerfile.web
│   └── cloudflared.yml
├── scripts/                    # migration runners, backup jobs, Pi kiosk setup
├── .env.example
├── package.json                # pnpm workspace root
└── README.md
```

## A word on AI-built code quality

Victor, you are going to have Claude Code build most of this. That's fine, but:

- **Run the test suite after every Claude Code session.** If it breaks, fix it before moving on. Debt compounds fast.
- **Commit after every working feature.** `git commit -m "feat(kds): render order grid"` — not one giant commit at the end.
- **Read the diffs.** You have a dev background. Spot-check Claude Code's output, especially anything involving money math (use integer cents, never floats — the build spec enforces this).
- **Don't let scope creep into MVP.** Every time you're tempted to add "just one more thing," write it into `docs/BACKLOG.md` and keep moving.
