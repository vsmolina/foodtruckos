import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
