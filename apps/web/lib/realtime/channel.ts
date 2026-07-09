import type Redis from 'ioredis';
import { createRedis, redis } from '@/lib/redis';

/**
 * Redis pub/sub helpers for the realtime layer. The webhook handler publishes
 * kitchen-ticket events on `kds:store:<storeId>`; the Socket.IO server
 * subscribes and fans out to KDS clients (see docs Phase 2/3).
 */

/** Publish a JSON-serializable payload to a channel. Returns subscriber count. */
export async function publish(channel: string, payload: unknown): Promise<number> {
  return redis.publish(channel, JSON.stringify(payload));
}

export type Unsubscribe = () => Promise<void>;

/**
 * Subscribe to one or more channel patterns. The handler receives the parsed
 * JSON payload and the concrete channel it arrived on. A subscriber connection
 * can't run normal commands, so this opens a dedicated client each call.
 */
export async function subscribe(
  pattern: string,
  handler: (payload: unknown, channel: string) => void,
): Promise<Unsubscribe> {
  const sub: Redis = createRedis();
  const isPattern = pattern.includes('*');

  if (isPattern) {
    await sub.psubscribe(pattern);
    sub.on('pmessage', (_pattern, channel, message) => {
      handler(safeParse(message), channel);
    });
  } else {
    await sub.subscribe(pattern);
    sub.on('message', (channel, message) => {
      handler(safeParse(message), channel);
    });
  }

  return async () => {
    if (isPattern) {
      await sub.punsubscribe(pattern);
    } else {
      await sub.unsubscribe(pattern);
    }
    sub.disconnect();
  };
}

function safeParse(message: string): unknown {
  try {
    return JSON.parse(message);
  } catch {
    return message;
  }
}
