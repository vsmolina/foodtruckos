import { sql as pg } from '@/lib/db/client';
import { redis } from '@/lib/redis';

// Never cache health checks.
export const dynamic = 'force-dynamic';

async function checkDb(): Promise<'ok' | 'fail'> {
  try {
    await pg`select 1`;
    return 'ok';
  } catch {
    return 'fail';
  }
}

async function checkRedis(): Promise<'ok' | 'fail'> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG' ? 'ok' : 'fail';
  } catch {
    return 'fail';
  }
}

export async function GET(): Promise<Response> {
  const [dbStatus, redisStatus] = await Promise.all([checkDb(), checkRedis()]);
  const healthy = dbStatus === 'ok' && redisStatus === 'ok';

  return Response.json(
    { db: dbStatus, redis: redisStatus, time: new Date().toISOString() },
    { status: healthy ? 200 : 503 },
  );
}
