import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { webOrders, type WebOrderLine } from '@/lib/db/schema';
import { syncOrderStatus } from './status';

/** What the status page may show — no phone number, no internal ids. */
export type PublicOrder = {
  code: string;
  status: (typeof webOrders.$inferSelect)['status'];
  name: string;
  lines: WebOrderLine[];
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  smsOptIn: boolean;
  placedAt: string;
  estimatedReadyAt: string | null;
  readyAt: string | null;
};

export async function publicOrderByToken(token: string, sync = true): Promise<PublicOrder | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [row] = await db.select().from(webOrders).where(eq(webOrders.token, token));
  if (!row) return null;
  const o = sync ? ((await syncOrderStatus(row.id)) ?? row) : row;
  return {
    code: o.code,
    status: o.status,
    name: o.customerName,
    lines: o.lines,
    subtotalCents: o.subtotalCents,
    taxCents: o.taxCents,
    tipCents: o.tipCents,
    totalCents: o.totalCents,
    smsOptIn: o.smsOptIn,
    placedAt: o.createdAt.toISOString(),
    estimatedReadyAt: o.estimatedReadyAt?.toISOString() ?? null,
    readyAt: o.readyAt?.toISOString() ?? null,
  };
}
