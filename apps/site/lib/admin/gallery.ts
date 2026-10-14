import 'server-only';
import { revalidatePath } from 'next/cache';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { GalleryCounts, GalleryPhotoDto, GalleryView, TakedownDto } from '@barrio/site-contract';
import { db } from '@/lib/db/client';
import { galleryPhotos, takedownRequests } from '@/lib/db/schema';
import { ADMIN_CONSENT } from '@/lib/gallery/consent';
import { UploadError, storeImage } from '@/lib/storage';
import { fail, invalid, ok, type Result } from './result';

// Gallery moderation: consent, approve / reject / remove, owner uploads and
// takedown requests. No auth here: callers (admin server actions, admin API)
// check it first. A photo is public only when approved AND consent confirmed.

type PhotoRow = typeof galleryPhotos.$inferSelect;

const refresh = (): void => revalidatePath('/', 'layout');
const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export function photoDto(p: PhotoRow): GalleryPhotoDto {
  return {
    id: p.id,
    url: p.url,
    width: p.width,
    height: p.height,
    caption: p.caption,
    source: p.source,
    status: p.status,
    submitterName: p.submitterName,
    submitterEmail: p.submitterEmail,
    submitterInstagram: p.submitterInstagram,
    consentConfirmed: p.consentConfirmed,
    consentBy: p.consentBy,
    consentAt: iso(p.consentAt),
    reviewedAt: iso(p.reviewedAt),
    createdAt: p.createdAt.toISOString(),
  };
}

export async function galleryCounts(): Promise<GalleryCounts> {
  const [byStatus, [open]] = await Promise.all([
    db.select({ status: galleryPhotos.status, n: count() }).from(galleryPhotos).groupBy(galleryPhotos.status),
    db.select({ n: count() }).from(takedownRequests).where(eq(takedownRequests.status, 'open')),
  ]);
  const n = (s: PhotoRow['status']) => byStatus.find((r) => r.status === s)?.n ?? 0;
  return { pending: n('pending'), approved: n('approved'), removed: n('removed') + n('rejected'), takedowns: open?.n ?? 0 };
}

/** Photos for one admin view, newest first (removed view: removed, then rejected). */
export async function listPhotos(view: GalleryView): Promise<PhotoRow[]> {
  if (view === 'removed') {
    const [removed, rejected] = await Promise.all([
      db.select().from(galleryPhotos).where(eq(galleryPhotos.status, 'removed')).orderBy(desc(galleryPhotos.createdAt)).limit(200),
      db.select().from(galleryPhotos).where(eq(galleryPhotos.status, 'rejected')).orderBy(desc(galleryPhotos.createdAt)).limit(100),
    ]);
    return [...removed, ...rejected];
  }
  return db.select().from(galleryPhotos).where(eq(galleryPhotos.status, view)).orderBy(desc(galleryPhotos.createdAt)).limit(200);
}

/** Open takedown requests with their linked photo, newest first. */
export async function listTakedowns(): Promise<Array<{ req: typeof takedownRequests.$inferSelect; photo: PhotoRow | null }>> {
  return db
    .select({ req: takedownRequests, photo: galleryPhotos })
    .from(takedownRequests)
    .leftJoin(galleryPhotos, eq(takedownRequests.photoId, galleryPhotos.id))
    .where(eq(takedownRequests.status, 'open'))
    .orderBy(desc(takedownRequests.createdAt));
}

export function takedownDto({ req, photo }: { req: typeof takedownRequests.$inferSelect; photo: PhotoRow | null }): TakedownDto {
  return {
    id: req.id,
    name: req.name,
    email: req.email,
    description: req.description,
    reason: req.reason,
    createdAt: req.createdAt.toISOString(),
    photo: photo ? photoDto(photo) : null,
  };
}

const Id = z.object({ id: z.uuid('Unknown photo.') });
const ViewSchema = z.object({ view: z.enum(['pending', 'approved', 'removed']) });

export async function galleryList(input: unknown): Promise<Result<{ photos: GalleryPhotoDto[]; counts: GalleryCounts }>> {
  const parsed = ViewSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const [rows, counts] = await Promise.all([listPhotos(parsed.data.view), galleryCounts()]);
  return ok({ photos: rows.map(photoDto), counts });
}

export async function galleryTakedowns(): Promise<Result<{ requests: TakedownDto[]; counts: GalleryCounts }>> {
  const [rows, counts] = await Promise.all([listTakedowns(), galleryCounts()]);
  return ok({ requests: rows.map(takedownDto), counts });
}

/** Update one photo; `where` adds conditions (e.g. consent must be confirmed). */
async function updatePhoto(id: string, values: Partial<typeof galleryPhotos.$inferInsert>): Promise<PhotoRow | null> {
  const [row] = await db.update(galleryPhotos).set(values).where(eq(galleryPhotos.id, id)).returning();
  if (row) refresh();
  return row ?? null;
}

const notFound = () => fail('That photo no longer exists.');

/** Approve: only possible once consent is confirmed (enforced here, not just in the UI). */
export async function approvePhoto(input: unknown): Promise<Result<GalleryPhotoDto>> {
  const parsed = Id.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const [row] = await db
    .update(galleryPhotos)
    .set({ status: 'approved', reviewedAt: new Date() })
    .where(and(eq(galleryPhotos.id, parsed.data.id), eq(galleryPhotos.consentConfirmed, true)))
    .returning();
  if (row) {
    refresh();
    return ok(photoDto(row));
  }
  const [exists] = await db.select({ id: galleryPhotos.id }).from(galleryPhotos).where(eq(galleryPhotos.id, parsed.data.id));
  return exists ? fail('Confirm that everyone in the photo agreed before approving it.') : notFound();
}

function statusChange(status: 'rejected' | 'removed' | 'pending') {
  return async (input: unknown): Promise<Result<GalleryPhotoDto>> => {
    const parsed = Id.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const row = await updatePhoto(parsed.data.id, status === 'pending' ? { status } : { status, reviewedAt: new Date() });
    return row ? ok(photoDto(row)) : notFound();
  };
}

export const rejectPhoto = statusChange('rejected');
export const removePhoto = statusChange('removed');
/** Removed / rejected → back to pending. */
export const restoreToPending = statusChange('pending');

const ConsentSchema = Id.extend({ confirm: z.literal(true, 'Tick the box to confirm consent.') });

/** Owner confirms everyone identifiable agreed. Requires the explicit checkbox. */
export async function confirmConsent(input: unknown): Promise<Result<GalleryPhotoDto>> {
  const parsed = ConsentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const row = await updatePhoto(parsed.data.id, {
    consentConfirmed: true,
    consentBy: 'admin',
    consentText: ADMIN_CONSENT,
    consentAt: new Date(),
  });
  return row ? ok(photoDto(row)) : notFound();
}

const CaptionSchema = Id.extend({ caption: z.string().trim().max(140, 'Keep it under 140 characters.') });

export async function setCaption(input: unknown): Promise<Result<GalleryPhotoDto>> {
  const parsed = CaptionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const row = await updatePhoto(parsed.data.id, { caption: parsed.data.caption || null });
  return row ? ok(photoDto(row)) : notFound();
}

const UploadSchema = z.object({
  caption: z.string().trim().max(140, 'Keep it under 140 characters.'),
  consentConfirmed: z.boolean(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
});

/**
 * Store one owner photo as pending. Consent can be confirmed at upload time
 * (same wording as the confirm step); approving is still a separate step.
 */
export async function uploadOwnerPhoto(file: File | null, input: unknown): Promise<Result<GalleryPhotoDto>> {
  const parsed = UploadSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!file) return fail('Choose a photo.', { photo: 'Choose a photo.' });
  let url: string;
  try {
    url = await storeImage(file, 'gallery');
  } catch (err) {
    const msg = err instanceof UploadError ? err.message : 'Upload failed.';
    return fail(msg, { photo: msg });
  }
  const d = parsed.data;
  const size = d.width && d.height ? { width: d.width, height: d.height } : await imageSize(file);
  const [row] = await db
    .insert(galleryPhotos)
    .values({
      url,
      width: size?.width ?? null,
      height: size?.height ?? null,
      caption: d.caption || null,
      source: 'owner',
      status: 'pending',
      consentConfirmed: d.consentConfirmed,
      ...(d.consentConfirmed ? { consentBy: 'admin', consentText: ADMIN_CONSENT, consentAt: new Date() } : {}),
    })
    .returning();
  refresh();
  return ok(photoDto(row!));
}

const ResolveSchema = z.object({ id: z.uuid('Unknown request.'), photoId: z.union([z.uuid('Paste a photo id.'), z.literal('')]).optional() });

/** One action: unpublish the photo (if any) and close the request. */
export async function resolveTakedown(input: unknown): Promise<Result<{ resolved: true }>> {
  const parsed = ResolveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id } = parsed.data;
  const [req] = await db.select().from(takedownRequests).where(eq(takedownRequests.id, id)).limit(1);
  if (!req) return fail('That request no longer exists.');
  const photoId = parsed.data.photoId || req.photoId;
  if (photoId) {
    await db.update(galleryPhotos).set({ status: 'removed', reviewedAt: new Date() }).where(eq(galleryPhotos.id, photoId));
    if (!req.photoId) await db.update(takedownRequests).set({ photoId }).where(eq(takedownRequests.id, id));
  }
  await db.update(takedownRequests).set({ status: 'done', resolvedAt: new Date() }).where(eq(takedownRequests.id, id));
  refresh();
  return ok({ resolved: true as const });
}

export async function dismissTakedown(input: unknown): Promise<Result<{ resolved: true }>> {
  const parsed = z.object({ id: z.uuid('Unknown request.') }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await db
    .update(takedownRequests)
    .set({ status: 'done', resolvedAt: new Date() })
    .where(inArray(takedownRequests.id, [parsed.data.id]));
  refresh();
  return ok({ resolved: true as const });
}

/** Pixel size from a PNG / JPEG / WebP header, so the gallery grid can reserve space. */
export async function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  const b = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  try {
    // PNG: IHDR right after the 8-byte signature.
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { width: dv.getUint32(16), height: dv.getUint32(20) };
    // WebP: RIFF....WEBP + VP8 / VP8L / VP8X chunk.
    if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) {
      const chunk = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!);
      if (chunk === 'VP8X') return { width: 1 + (dv.getUint32(24, true) & 0xffffff), height: 1 + (dv.getUint32(27, true) & 0xffffff) };
      if (chunk === 'VP8L') {
        const bits = dv.getUint32(21, true);
        return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
      }
      if (chunk === 'VP8 ') return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
      return null;
    }
    // JPEG: walk the markers to the first SOFn frame header.
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) return null;
        const marker = b[i + 1]!;
        const len = dv.getUint16(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { width: dv.getUint16(i + 7), height: dv.getUint16(i + 5) };
        }
        i += 2 + len;
      }
    }
  } catch {
    // Truncated or odd header: no size is fine.
  }
  return null;
}
