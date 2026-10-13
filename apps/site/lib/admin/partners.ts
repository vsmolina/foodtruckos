import 'server-only';
import { revalidatePath } from 'next/cache';
import { and, asc, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import type { PartnerDto, PartnerStatsDto } from '@barrio/site-contract';
import { db } from '@/lib/db/client';
import { partners } from '@/lib/db/schema';
import { cleanHandle } from '@/lib/gallery/consent';
import { referralQrSvg, referralUrl } from '@/lib/partners/qr';
import { partnerStats } from '@/lib/partners/stats';
import { UploadError, storeImage } from '@/lib/storage';
import { fail, invalid, ok, type Result } from './result';

// Partners (bars, bartenders) with referral codes, links and QR cards. No auth
// here: callers (admin server actions, admin API) check it first.

type PartnerRow = typeof partners.$inferSelect;

const refresh = (): void => revalidatePath('/', 'layout');
const EMPTY_STATS: PartnerStatsDto = { visits30: 0, orders: 0, revenueCents: 0 };

export function partnerDto(p: PartnerRow, stats: PartnerStatsDto = EMPTY_STATS): PartnerDto {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    blurb: p.blurb,
    photoUrl: p.photoUrl,
    instagram: p.instagram,
    url: p.url,
    code: p.code,
    referralUrl: referralUrl(p.code),
    active: p.active,
    sortOrder: p.sortOrder,
    createdAt: p.createdAt.toISOString(),
    stats,
  };
}

export async function listPartners(): Promise<{ partners: PartnerDto[]; totals: PartnerStatsDto }> {
  const rows = await db.select().from(partners).orderBy(asc(partners.sortOrder), asc(partners.name));
  const stats = await partnerStats(rows.map((r) => r.id));
  const list = rows.map((r) => partnerDto(r, stats.get(r.id)));
  const totals = list.reduce(
    (a, p) => ({ visits30: a.visits30 + p.stats.visits30, orders: a.orders + p.stats.orders, revenueCents: a.revenueCents + p.stats.revenueCents }),
    EMPTY_STATS,
  );
  return { partners: list, totals };
}

const IdSchema = z.object({ id: z.uuid('Unknown partner.') });

async function findPartner(id: string): Promise<PartnerDto | null> {
  const [row] = await db.select().from(partners).where(eq(partners.id, id)).limit(1);
  if (!row) return null;
  const stats = await partnerStats([row.id]);
  return partnerDto(row, stats.get(row.id));
}

const notFound = () => fail('That partner no longer exists.');

export async function getPartner(input: unknown): Promise<Result<PartnerDto>> {
  const parsed = IdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const p = await findPartner(parsed.data.id);
  return p ? ok(p) : notFound();
}

const SaveSchema = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1, 'Name is required.').max(80),
  kind: z.enum(['bar', 'bartender', 'other']),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,16}$/, 'Use 3–16 letters or numbers, no spaces.'),
  blurb: z.string().trim().max(280, 'Keep it under 280 characters.'),
  instagram: z.string().trim().max(60).transform(cleanHandle),
  url: z
    .string()
    .trim()
    .max(300)
    .refine((u) => u === '' || /^https?:\/\/\S+$/.test(u), 'Start the link with https://'),
  sortOrder: z.coerce.number().int().min(0).max(999),
  active: z.boolean(),
});

/** Create (`id: null`) or update a partner; an optional photo replaces the current one. */
export async function savePartner(input: unknown, photo: File | null): Promise<Result<PartnerDto>> {
  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...d } = parsed.data;

  if (id && !(await findPartner(id))) return notFound();
  const [clash] = await db
    .select({ id: partners.id })
    .from(partners)
    .where(id ? and(eq(partners.code, d.code), ne(partners.id, id)) : eq(partners.code, d.code))
    .limit(1);
  if (clash) return fail('Check the highlighted fields.', { code: 'Another partner already uses that code.' });

  let photoUrl: string | undefined;
  if (photo) {
    try {
      photoUrl = await storeImage(photo, 'partners');
    } catch (err) {
      return fail('Check the photo.', { photo: err instanceof UploadError ? err.message : 'Upload failed.' });
    }
  }

  const values = {
    name: d.name,
    kind: d.kind,
    code: d.code,
    blurb: d.blurb || null,
    instagram: d.instagram || null,
    url: d.url || null,
    sortOrder: d.sortOrder,
    active: d.active,
    ...(photoUrl ? { photoUrl } : {}),
  };
  const [row] = id
    ? await db.update(partners).set(values).where(eq(partners.id, id)).returning()
    : await db.insert(partners).values(values).returning();
  refresh();
  return ok((await findPartner(row!.id))!);
}

export async function removePartnerPhoto(input: unknown): Promise<Result<PartnerDto>> {
  const parsed = IdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const [row] = await db.update(partners).set({ photoUrl: null }).where(eq(partners.id, parsed.data.id)).returning({ id: partners.id });
  if (!row) return notFound();
  refresh();
  return ok((await findPartner(row.id))!);
}

/** Deletes the partner and its scan history (cascade); credited orders keep no partner. */
export async function deletePartner(input: unknown): Promise<Result<{ deleted: true }>> {
  const parsed = IdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const [row] = await db.delete(partners).where(eq(partners.id, parsed.data.id)).returning({ id: partners.id });
  if (!row) return notFound();
  refresh();
  return ok({ deleted: true as const });
}

export async function partnerQr(input: unknown): Promise<Result<{ partner: PartnerDto; svg: string; referralUrl: string }>> {
  const parsed = IdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const p = await findPartner(parsed.data.id);
  if (!p) return notFound();
  return ok({ partner: p, svg: await referralQrSvg(p.code), referralUrl: p.referralUrl });
}
