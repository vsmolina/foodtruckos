'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { siteSettings, weeklyHours } from '@/lib/db/schema';
import { getSettings } from '@/lib/status';

export type ActionState = { ok?: string; error?: string; fieldErrors?: Record<string, string> };

function refresh(): void {
  revalidatePath('/', 'layout');
}

/** One-tap status switch from the big buttons. */
export async function setStatus(status: 'open' | 'closed' | 'back_soon'): Promise<void> {
  await requireAdmin();
  await getSettings();
  await db.update(siteSettings).set({ status }).where(eq(siteSettings.id, 1));
  refresh();
}

export async function setOrderingPaused(paused: boolean): Promise<void> {
  await requireAdmin();
  await getSettings();
  await db.update(siteSettings).set({ orderingPaused: paused }).where(eq(siteSettings.id, 1));
  refresh();
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

export async function saveMessages(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = MessagesSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Check the highlighted fields.', fieldErrors: flatten(parsed.error) };
  await getSettings();
  await db.update(siteSettings).set(parsed.data).where(eq(siteSettings.id, 1));
  refresh();
  return { ok: 'Saved.' };
}

const LocationSchema = z.object({
  locationName: z.string().trim().min(2).max(80),
  address: z.string().trim().min(2).max(120),
  lat: z.string().trim().regex(/^-?\d{1,3}\.\d{3,8}$/, 'Like 29.8830'),
  lng: z.string().trim().regex(/^-?\d{1,3}\.\d{3,8}$/, 'Like -97.9411'),
  lateNightNote: optionalText(240),
  phone: optionalText(30),
  instagram: z.string().trim().regex(/^[A-Za-z0-9._]{1,30}$/, 'Handle without @'),
});

export async function saveLocation(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = LocationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Check the highlighted fields.', fieldErrors: flatten(parsed.error) };
  await getSettings();
  await db.update(siteSettings).set(parsed.data).where(eq(siteSettings.id, 1));
  refresh();
  return { ok: 'Saved.' };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveHours(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const rows = [];
  const fieldErrors: Record<string, string> = {};
  for (let d = 0; d < 7; d++) {
    const closed = form.get(`closed-${d}`) === 'on';
    const opens = String(form.get(`opens-${d}`) ?? '');
    const closes = String(form.get(`closes-${d}`) ?? '');
    const note = String(form.get(`note-${d}`) ?? '').trim().slice(0, 60) || null;
    if (!closed && (!TIME.test(opens) || !TIME.test(closes))) fieldErrors[`day-${d}`] = 'Set both times, or mark closed.';
    rows.push({ dayOfWeek: d, closed, opens: closed ? null : opens, closes: closed ? null : closes, note });
  }
  if (Object.keys(fieldErrors).length) return { error: 'Some days need times.', fieldErrors };
  for (const r of rows) {
    await db.insert(weeklyHours).values(r).onConflictDoUpdate({ target: weeklyHours.dayOfWeek, set: r });
  }
  refresh();
  return { ok: 'Hours saved.' };
}

function flatten(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? '');
    out[key] ??= issue.message;
  }
  return out;
}
