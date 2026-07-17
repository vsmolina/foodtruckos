import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // NOTE: we run a custom server (server.ts, for Socket.IO), which is
  // incompatible with `output: 'standalone'`. The Docker runner runs the
  // custom server directly (see infra/Dockerfile.web).
  // Monorepo root is two levels up; silences Next's workspace-root inference.
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
