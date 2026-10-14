import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { siteSettings, weeklyHours } from '@/lib/db/schema';
import { estimateWaitMinutes } from '@/lib/kitchen';

export type Settings = typeof siteSettings.$inferSelect;
export type DayHours = typeof weeklyHours.$inferSelect;

/** The single settings row; created with defaults on first read. */
export async function getSettings(): Promise<Settings> {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1));
  if (row) return row;
  const [created] = await db.insert(siteSettings).values({ id: 1 }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(siteSettings).where(eq(siteSettings.id, 1)))[0]!;
}

export async function getWeeklyHours(): Promise<DayHours[]> {
  return db.select().from(weeklyHours).orderBy(asc(weeklyHours.dayOfWeek));
}

export type OrderingState =
  | { canOrder: true; waitMinutes: number }
  | { canOrder: false; reason: 'closed' | 'back_soon' | 'paused'; message: string | null };

/** Whether online ordering is allowed right now, and the current wait. */
export async function orderingState(settings?: Settings): Promise<OrderingState> {
  const s = settings ?? (await getSettings());
  if (s.status === 'back_soon') return { canOrder: false, reason: 'back_soon', message: s.statusMessage };
  if (s.status !== 'open') return { canOrder: false, reason: 'closed', message: s.statusMessage };
  if (s.orderingPaused) return { canOrder: false, reason: 'paused', message: s.pausedMessage };
  return { canOrder: true, waitMinutes: await estimateWaitMinutes(s.defaultWaitMinutes) };
}

/** Today's hours (in the truck's timezone) — the night that started today. */
export function todaysHours(hours: DayHours[], now = new Date()): DayHours | undefined {
  const dow = Number(
    new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/Chicago' })
      .formatToParts(now)
      .find((p) => p.type === 'weekday')
      ?.value.replace(/Sun/, '0')
      .replace(/Mon/, '1')
      .replace(/Tue/, '2')
      .replace(/Wed/, '3')
      .replace(/Thu/, '4')
      .replace(/Fri/, '5')
      .replace(/Sat/, '6'),
  );
  return hours.find((h) => h.dayOfWeek === dow);
}
