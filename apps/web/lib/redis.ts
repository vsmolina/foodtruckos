import Redis from 'ioredis';

// `lazyConnect` so importing this module never opens a socket at build time;
// the connection is established on first command. A real REDIS_URL is required
// to actually reach Redis at runtime.
const url = process.env.REDIS_URL ?? 'redis://localhost:6379';

// Reuse connections across hot reloads in dev. A Redis client in subscriber
// mode can't issue normal commands, so pub/sub gets its own connections
// (see lib/realtime/channel.ts).
const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ?? new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true });

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

/** Open a fresh Redis connection (used for dedicated subscriber clients). */
export function createRedis(): Redis {
  return new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true });
}
