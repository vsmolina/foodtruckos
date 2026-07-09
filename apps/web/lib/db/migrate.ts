import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Run all pending migrations, then exit. Invoked on container startup
 * (see infra/Dockerfile.web entrypoint) and via `pnpm db:migrate`.
 */
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  // A dedicated single connection for the migration run.
  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);

  console.info('[migrate] running migrations…');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.info('[migrate] done.');

  await migrationClient.end();
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
