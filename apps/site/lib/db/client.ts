import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// postgres.js connects lazily (on first query), so the default is safe at build
// time. On Vercel, point DATABASE_URL at a pooled connection string (Neon's
// `-pooler` host) and keep `max` small: every serverless instance opens its own.
const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://foodtruck:foodtruck@localhost:5433/barrio_site';

const globalForDb = globalThis as unknown as { sitePg?: ReturnType<typeof postgres> };

export const sql =
  globalForDb.sitePg ??
  postgres(connectionString, {
    max: process.env.VERCEL ? 3 : 10,
    connect_timeout: 5,
    // Neon's pooler (PgBouncer, transaction mode) can't use prepared statements.
    prepare: !/-pooler\./.test(connectionString),
  });

if (process.env.NODE_ENV !== 'production') globalForDb.sitePg = sql;

export const db = drizzle(sql, { schema });
export { schema };
