import { eq } from 'drizzle-orm';
import { db, sql } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';

/**
 * Set (or reset) the single admin's login password.
 *
 *   pnpm --filter web admin:set-password <email> <password>
 *
 * Falls back to INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD from the
 * environment when args are omitted. Creates the user row if it doesn't exist.
 * Only the email matching INITIAL_ADMIN_EMAIL can actually sign in (see auth.ts).
 */
async function main(): Promise<void> {
  const email = (process.argv[2] ?? process.env.INITIAL_ADMIN_EMAIL ?? '').toLowerCase();
  const password = process.argv[3] ?? process.env.INITIAL_ADMIN_PASSWORD ?? '';

  if (!email || !password) {
    console.error(
      'Usage: pnpm --filter web admin:set-password <email> <password>\n' +
        '  (or set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD in the environment)',
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing) {
    await db.update(users).set({ passwordHash }).where(eq(users.id, existing.id));
    console.info(`[admin] updated password for ${email}`);
  } else {
    await db.insert(users).values({ email, name: 'Owner', passwordHash });
    console.info(`[admin] created admin user ${email}`);
  }

  await sql.end();
}

main().catch((err) => {
  console.error('[admin] failed:', err);
  process.exit(1);
});
