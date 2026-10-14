import { spawnSync } from 'node:child_process';
import { eq } from 'drizzle-orm';
import { db, sql } from '@/lib/db/client';
import { businesses, stores, users } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';

/**
 * First-run setup, safe to run on every container start (see infra/entrypoint.sh).
 * Only ever ADDS what's missing — never overwrites existing data:
 *
 *  - No business yet → create the business + store. With SEED_DEMO_MENU=1
 *    (dev) it runs the full seed instead, which adds the placeholder menu.
 *    In production leave it off and use "Pull from Square" for the real menu.
 *  - INITIAL_ADMIN_EMAIL + INITIAL_ADMIN_PASSWORD set and that admin has no
 *    password yet → create/set it. An existing password is never replaced
 *    (use `admin:set-password` to change it).
 */
async function main(): Promise<void> {
  const [business] = await db.select({ id: businesses.id }).from(businesses).limit(1);
  if (!business) {
    if (process.env.SEED_DEMO_MENU === '1') {
      console.info('[bootstrap] empty database → seeding demo business, store and placeholder menu');
      const r = spawnSync(process.execPath, ['--import', 'tsx', 'lib/db/seed.ts'], { stdio: 'inherit' });
      if (r.status !== 0) throw new Error('seed failed');
    } else {
      console.info('[bootstrap] empty database → creating business + store (menu comes from Square)');
      const [b] = await db
        .insert(businesses)
        .values({ name: process.env.BUSINESS_NAME || "Victor's Food Truck", timezone: 'America/Chicago' })
        .returning({ id: businesses.id });
      await db.insert(stores).values({
        businessId: b!.id,
        name: process.env.STORE_NAME || 'San Marcos',
        squareLocationId: process.env.SQUARE_LOCATION_ID || null,
      });
    }
  }

  const email = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (email && password) {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user?.passwordHash) {
      if (password.length < 8) throw new Error('INITIAL_ADMIN_PASSWORD must be at least 8 characters');
      const passwordHash = await hashPassword(password);
      if (user) await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
      else await db.insert(users).values({ email, name: 'Owner', passwordHash });
      console.info(`[bootstrap] admin login created for ${email}`);
    }
  }
}

main()
  .then(() => sql.end())
  .catch(async (err) => {
    console.error('[bootstrap] failed:', err);
    await sql.end();
    process.exit(1);
  });
