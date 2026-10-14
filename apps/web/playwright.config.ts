import { defineConfig } from '@playwright/test';

// KDS E2E. The web server runs in SQUARE_MOCK mode so `retrieveOrder` hydrates
// from a fixture — no Square account, no network. It still needs a live Postgres
// + Redis (migrated and seeded) so the ingest → DB → Redis → socket path is real.
//
// Ports default to the standard localhost stack; override DATABASE_URL / REDIS_URL
// if your compose publishes them elsewhere (e.g. 5433/6380 when another Postgres
// already owns 5432). See docs/TESTING.md.
const PORT = process.env.KDS_TEST_PORT ?? '3100';
const BASE_URL = `http://localhost:${PORT}`;
const SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? 'devkey';
const NOTIFICATION_URL = `${BASE_URL}/api/webhooks/square`;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // shared DB state; run serially
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    // The KDS page is LAN-gated by proxy.ts; Playwright hits localhost (127.0.0.1),
    // which passes. trace on first retry for debugging.
    trace: 'on-first-retry',
  },
  webServer: {
    // Run a PRODUCTION build, not dev. Next's dev server (with a custom
    // Socket.IO server) wedges under a real browser: once the KDS page is open,
    // its dev HMR/streaming connections block the single custom HTTP server from
    // handling ANY further request — so the webhook POST that drives the test
    // hangs. A prod build has no HMR and serves fine under load. See docs/TESTING.md.
    command: 'npx next build && npx tsx server.ts',
    // Readiness probe: the health route responds fast (checks DB + Redis).
    url: `${BASE_URL}/api/health`,
    timeout: 180_000, // includes the production build
    reuseExistingServer: !process.env.CI,
    env: {
      SQUARE_MOCK: '1',
      NODE_ENV: 'production',
      PORT,
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgresql://foodtruck:foodtruck@localhost:5432/foodtruck',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
      SQUARE_WEBHOOK_SIGNATURE_KEY: SIGNATURE_KEY,
      SQUARE_WEBHOOK_NOTIFICATION_URL: NOTIFICATION_URL,
    },
  },
});
