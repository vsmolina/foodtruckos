import 'server-only';
import { revalidatePath } from 'next/cache';
import { asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { SpecialDto, SpecialState } from '@barrio/site-contract';
import { db } from '@/lib/db/client';
import { specials } from '@/lib/db/schema';
import { fromLocalInput, toLocalInput } from '@/lib/format';
import { storeImage, UploadError } from '@/lib/storage';
import { fail, invalid, ok, type Result } from './result';

// Specials shown on Home and /specials. No auth here: callers (admin server
// actions, admin API) check it first. Times are entered as datetime-local
// strings in the truck's timezone.

type Row = typeof specials.$inferSelect;

const refresh = (): void => revalidatePath('/', 'layout');

export function specialState(s: Pick<Row, 'active' | 'startsAt' | 'endsAt'>, now = new Date()): SpecialState {
  if (!s.active) return 'off';
  if (s.endsAt && s.endsAt <= now) return 'ended';
  if (s.startsAt && s.startsAt > now) return 'scheduled';
  return 'live';
}

export function toSpecialDto(s: Row): SpecialDto {
  return {
    id: s.id,
    title: s.title,
    kicker: s.kicker,
    body: s.body,
    priceLabel: s.priceLabel,
    photoUrl: s.photoUrl,
    startsAt: s.startsAt?.toISOString() ?? null,
    endsAt: s.endsAt?.toISOString() ?? null,
    startsAtLocal: toLocalInput(s.startsAt),
    endsAtLocal: toLocalInput(s.endsAt),
    active: s.active,
    sortOrder: s.sortOrder,
    state: specialState(s),
  };
}

export async function listSpecials(): Promise<SpecialDto[]> {
  const rows = await db.select().from(specials).orderBy(desc(specials.active), asc(specials.sortOrder), desc(specials.createdAt));
  return rows.map(toSpecialDto);
}

const IdSchema = z.object({ id: z.string().uuid('Unknown special.') });

export async function getSpecial(input: unknown): Promise<Result<SpecialDto>> {
  const parsed = IdSchema.safeParse(input);
  if (!parsed.success) return fail('That special no longer exists.');
  const [row] = await db.select().from(specials).where(eq(specials.id, parsed.data.id));
  return row ? ok(toSpecialDto(row)) : fail('That special no longer exists.');
}

const when = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === '') return null;
    const d = fromLocalInput(v);
    if (!d) ctx.addIssue({ code: 'custom', message: 'Pick a date and time.' });
    return d;
  });

const SaveSchema = z
  .object({
    id: z.string().uuid().nullable(),
    title: z.string().trim().min(3, 'Give it a title.').max(80),
    kicker: z.string().trim().max(24),
    body: z.string().trim().max(400),
    priceLabel: z.string().trim().max(12),
    startsAt: when,
    endsAt: when,
    sortOrder: z.coerce.number().int().min(0).max(999),
    active: z.boolean(),
    removePhoto: z.boolean().default(false),
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt, { message: 'Ends must be after starts.', path: ['endsAt'] });

/** Create (`id: null`) or update a special; `photo` sets its photo. */
export async function saveSpecial(input: unknown, photo: File | null): Promise<Result<SpecialDto>> {
  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  let photoUrl: string | null | undefined;
  if (photo && photo.size > 0) {
    try {
      photoUrl = await storeImage(photo, 'specials');
    } catch (err) {
      const msg = err instanceof UploadError ? err.message : 'Upload failed.';
      return fail(msg, { photo: msg });
    }
  } else if (v.removePhoto) {
    photoUrl = null;
  }

  const values = {
    title: v.title,
    kicker: v.kicker || null,
    body: v.body || null,
    priceLabel: v.priceLabel || null,
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    sortOrder: v.sortOrder,
    active: v.active,
    ...(photoUrl !== undefined ? { photoUrl } : {}),
  };
  const [row] = v.id
    ? await db.update(specials).set(values).where(eq(specials.id, v.id)).returning()
    : await db.insert(specials).values(values).returning();
  if (!row) return fail('That special no longer exists.');
  refresh();
  return ok(toSpecialDto(row));
}

const ActiveSchema = z.object({ id: z.string().uuid(), active: z.boolean() });

export async function setSpecialActive(input: unknown): Promise<Result<SpecialDto>> {
  const parsed = ActiveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const [row] = await db.update(specials).set({ active: parsed.data.active }).where(eq(specials.id, parsed.data.id)).returning();
  if (!row) return fail('That special no longer exists.');
  refresh();
  return ok(toSpecialDto(row));
}

export async function deleteSpecial(input: unknown): Promise<Result<{ id: string }>> {
  const parsed = IdSchema.safeParse(input);
  if (!parsed.success) return fail('That special no longer exists.');
  const [row] = await db.delete(specials).where(eq(specials.id, parsed.data.id)).returning({ id: specials.id });
  if (!row) return fail('That special no longer exists.');
  refresh();
  return ok({ id: row.id });
}
