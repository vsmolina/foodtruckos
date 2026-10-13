import 'server-only';
import { count, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { merchOrders } from '@/lib/db/schema';

export async function merchToShip(): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(merchOrders)
    .where(eq(merchOrders.status, 'paid'));
  return r?.n ?? 0;
}
