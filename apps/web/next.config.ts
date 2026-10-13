import os from 'node:os';
import path from 'node:path';
import type { NextConfig } from 'next';

// This machine's LAN IPv4 addresses. The Pi kiosk loads the KDS via the Mac's LAN
// IP, and Next dev blocks its dev resources (HMR, fonts) from non-localhost
// origins — the board never hydrates and shows "offline". Dev-only setting.
const lanAddresses = Object.values(os.networkInterfaces())
  .flatMap((addrs) => addrs ?? [])
  .filter((a) => a.family === 'IPv4' && !a.internal)
  .map((a) => a.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanAddresses,
  // No Next.js "N" badge in dev — it sits on top of the KDS in the kitchen.
  devIndicators: false,
  // NOTE: we run a custom server (server.ts, for Socket.IO), which is
  // incompatible with `output: 'standalone'`. The Docker runner runs the
  // custom server directly (see infra/Dockerfile.web).
  // Monorepo root is two levels up; silences Next's workspace-root inference.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  experimental: {
    // Turbopack's persistent dev cache (.next/dev/cache) bloats over sessions
    // and, once stale, makes the dev server's memory grow ~30 MB/s while idle
    // until it dies with "JavaScript heap out of memory" (vercel/next.js#94915,
    // reproduced here on 16.2.10). With it off, memory stays flat (~700 MB);
    // the cost is a cold compile on each dev restart. Revisit after upgrading Next.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
