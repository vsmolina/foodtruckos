# foodtruck-os

A self-hosted, single-tenant operating system for Victor's food truck. It ingests
orders from **Square** (webhooks → hydrate via the Orders API), drives a **Kitchen
Display System** on a Raspberry Pi, and gives Victor a **business dashboard** on his
laptop. Square stays the system of record for payments in the MVP; we wrap it and
replace pieces later (Strangler Fig).

## Start here

New machine? Run through **[`docs/00-PREFLIGHT.md`](docs/00-PREFLIGHT.md)** first — it
installs the toolchain, gets Square credentials, and sets up the Cloudflare Tunnel.

Then read the design docs in order:

1. [`docs/01-ARCHITECTURE.md`](docs/01-ARCHITECTURE.md) — what we're building and why.
2. [`docs/02-BUILD-SPEC.md`](docs/02-BUILD-SPEC.md) — the authoritative, phased build plan.
3. [`docs/03-DESIGN-SYSTEM.md`](docs/03-DESIGN-SYSTEM.md) — the visual system.

## Layout

```
foodtruck-os/
├── apps/web/        # the Next.js app (KDS, dashboard, admin, webhooks — all in one)
├── packages/        # shared code, if/when we split
├── docs/            # architecture, build spec, design system
└── infra/           # Docker Compose, Dockerfiles, Cloudflare Tunnel (Phase 1+)
```

pnpm workspace monorepo. Requires Node 20+/22+, pnpm 9+, and (from Phase 1) Docker.

## Common commands

```bash
pnpm install            # install all workspace deps
pnpm dev                # run the web app in dev mode (http://localhost:3000)
pnpm build              # production build of the web app
pnpm start              # run the production build
pnpm lint               # eslint
pnpm test               # tests (added in later phases)
pnpm format             # prettier --write
pnpm format:check       # prettier --check

# Full stack (added in Phase 1):
# docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up
```

## Conventions

- **Money is integer cents**, never floats. Times are UTC in the DB; local timezone
  (`America/Chicago`) only at the UI edge.
- TypeScript strict, no `any`. Secrets live in `.env` (copy from `.env.example`), never
  committed. Conventional Commits. Every feature gets at least one test.
