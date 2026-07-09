import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for the Docker runner stage.
  output: 'standalone',
  // Monorepo root is two levels up; tells Next where to trace deps from.
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
