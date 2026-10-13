import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/** Run pending migrations, then exit. `pnpm --filter site db:migrate`. */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const client = postgres(url, { max: 1 });
  console.info('[migrate] running migrations…');
  await migrate(drizzle(client), { migrationsFolder: './drizzle' });
  console.info('[migrate] done.');
  await client.end();
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
