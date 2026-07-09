import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// postgres.js connects lazily (on first query), so a default here is safe at
// build time; a real DATABASE_URL is required to actually reach the DB.
const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://foodtruck:foodtruck@localhost:5432/foodtruck';

// Reuse a single postgres connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

export const sql =
  globalForDb.pgClient ??
  postgres(connectionString, {
    max: 10,
    // Every external call has a timeout (see docs/02-BUILD-SPEC.md ground rules).
    connect_timeout: 5,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pgClient = sql;
}

export const db = drizzle(sql, { schema });
export { schema };
