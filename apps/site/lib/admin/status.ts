import 'server-only';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DayHoursDto, StatusOverview } from '@barrio/site-contract';
import { db } from '@/lib/db/client';
import { siteSettings, weeklyHours } from '@/lib/db/schema';
import { getSettings, getWeeklyHours, orderingState } from '@/lib/status';
import { fail, invalid, ok, type Result } from './result';

// Truck status, ordering pause, messages, location and hours. No auth here:
// callers (admin server actions, admin API) check it first.

const refresh = (): void => revalidatePath('/', 'layout');

export async function statusOverview(): Promise<StatusOverview> {
  const [settings, hours] = await Promise.all([getSettings(), getWeeklyHours()]);
  const ordering = await orderingState(settings);
  return {
    settings: { ...settings, updatedAt: settings.updatedAt.toISOString() },
    hours: hours.map(({ dayOfWeek, opens, closes, closed, note }): DayHoursDto => ({ dayOfWeek, opens, closes, closed, note })),
    ordering,
  };
}

async function update(values: Partial<typeof siteSettings.$inferInsert>): Promise<void> {
  await getSettings(); // ensures the row exists
  await db.update(siteSettings).set(values).where(eq(siteSettings.id, 1));
  refresh();
}

const StatusSchema = z.object({ status: z.enum(['open', 'closed', 'back_soon']) });

export async function setStatus(input: unknown): Promise<Result<StatusOverview>> {
  const parsed = StatusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await update({ status: parsed.data.status });
  return ok(await statusOverview());
}

const PausedSchema = z.object({ paused: z.boolean() });

export async function setOrderingPaused(input: unknown): Promise<Result<StatusOverview>> {
  const parsed = PausedSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await update({ orderingPaused: parsed.data.paused });
  return ok(await statusOverview());
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v));

const MessagesSchema = z.object({
  statusMessage: optionalText(200),
  pausedMessage: optionalText(200),
  defaultWaitMinutes: z.coerce.number().int().min(3).max(90),
});

export async function saveMessages(input: unknown): Promise<Result<StatusOverview>> {
  const parsed = MessagesSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await update(parsed.data);
  return ok(await statusOverview());
}

const LocationSchema = z.object({
  locationName: z.string().trim().min(2).max(80),
  address: z.string().trim().min(2).max(120),
  lat: z.string().trim().regex(/^-?\d{1,3}\.\d{3,8}$/, 'Like 29.8830'),
  lng: z.string().trim().regex(/^-?\d{1,3}\.\d{3,8}$/, 'Like -97.9411'),
  lateNightNote: optionalText(240),
  phone: optionalText(30),
  instagram: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@/, ''))
    .pipe(z.string().regex(/^[A-Za-z0-9._]{1,30}$/, 'Handle without @')),
});

export async function saveLocation(input: unknown): Promise<Result<StatusOverview>> {
  const parsed = LocationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await update(parsed.data);
  return ok(await statusOverview());
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const HoursSchema = z.object({
  days: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        closed: z.boolean(),
        opens: z.string().trim(),
        closes: z.string().trim(),
        note: z.string().trim().max(60),
      }),
    )
    .length(7),
});

export async function saveHours(input: unknown): Promise<Result<StatusOverview>> {
  const parsed = HoursSchema.safeParse(input);
  if (!parsed.success) return fail('Send all seven days.');
  const fieldErrors: Record<string, string> = {};
  const rows = parsed.data.days.map((d) => {
    if (!d.closed && (!TIME.test(d.opens) || !TIME.test(d.closes))) fieldErrors[`day-${d.dayOfWeek}`] = 'Set both times, or mark closed.';
    return {
      dayOfWeek: d.dayOfWeek,
      closed: d.closed,
      opens: d.closed ? null : d.opens,
      closes: d.closed ? null : d.closes,
      note: d.note || null,
    };
  });
  if (new Set(rows.map((r) => r.dayOfWeek)).size !== 7) return fail('Send each day once.');
  if (Object.keys(fieldErrors).length) return fail('Some days need times.', fieldErrors);
  for (const r of rows) {
    await db.insert(weeklyHours).values(r).onConflictDoUpdate({ target: weeklyHours.dayOfWeek, set: r });
  }
  refresh();
  return ok(await statusOverview());
}
