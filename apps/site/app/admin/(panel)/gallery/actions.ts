'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { galleryPhotos, takedownRequests } from '@/lib/db/schema';
import { ADMIN_CONSENT } from '@/lib/gallery/consent';
import { UploadError, storeImage } from '@/lib/storage';

const done = () => {
  revalidatePath('/admin/gallery');
  revalidatePath('/gallery');
};

function idOf(form: FormData): string {
  const id = String(form.get('id') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('bad id');
  return id;
}

/** Approve: only possible once consent is confirmed (enforced here, not just in the UI). */
export async function approvePhoto(form: FormData): Promise<void> {
  await requireAdmin();
  await db
    .update(galleryPhotos)
    .set({ status: 'approved', reviewedAt: new Date() })
    .where(and(eq(galleryPhotos.id, idOf(form)), eq(galleryPhotos.consentConfirmed, true)));
  done();
}

export async function rejectPhoto(form: FormData): Promise<void> {
  await requireAdmin();
  await db.update(galleryPhotos).set({ status: 'rejected', reviewedAt: new Date() }).where(eq(galleryPhotos.id, idOf(form)));
  done();
}

export async function removePhoto(form: FormData): Promise<void> {
  await requireAdmin();
  await db.update(galleryPhotos).set({ status: 'removed', reviewedAt: new Date() }).where(eq(galleryPhotos.id, idOf(form)));
  done();
}

export async function restoreToPending(form: FormData): Promise<void> {
  await requireAdmin();
  await db.update(galleryPhotos).set({ status: 'pending' }).where(eq(galleryPhotos.id, idOf(form)));
  done();
}

/** Owner confirms consent for a photo they uploaded. Requires the checkbox. */
export async function confirmConsent(form: FormData): Promise<void> {
  await requireAdmin();
  if (form.get('confirm') !== 'yes') return;
  await db
    .update(galleryPhotos)
    .set({ consentConfirmed: true, consentBy: 'admin', consentText: ADMIN_CONSENT, consentAt: new Date() })
    .where(eq(galleryPhotos.id, idOf(form)));
  done();
}

export type UploadState = { ok?: number; error?: string };

export async function uploadOwnerPhotos(_prev: UploadState, form: FormData): Promise<UploadState> {
  await requireAdmin();
  const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: 'Choose at least one photo.' };
  if (files.length > 20) return { error: 'Upload 20 photos at a time at most.' };
  const caption = String(form.get('caption') ?? '').trim().slice(0, 140) || null;
  const sizes = String(form.get('sizes') ?? '')
    .split(',')
    .map((s) => s.split('x').map(Number));
  let ok = 0;
  const errors: string[] = [];
  for (const [i, file] of files.entries()) {
    try {
      const url = await storeImage(file, 'gallery');
      const [w, h] = sizes[i] ?? [];
      await db.insert(galleryPhotos).values({
        url,
        width: w || null,
        height: h || null,
        caption,
        source: 'owner',
        status: 'pending',
        consentConfirmed: false,
      });
      ok++;
    } catch (err) {
      errors.push(`${file.name}: ${err instanceof UploadError ? err.message : 'upload failed'}`);
    }
  }
  done();
  return errors.length ? { ok, error: errors.join(' ') } : { ok };
}

/** One action: unpublish the photo (if any) and close the request. */
export async function resolveTakedown(form: FormData): Promise<void> {
  await requireAdmin();
  const id = idOf(form);
  const [req] = await db.select().from(takedownRequests).where(eq(takedownRequests.id, id)).limit(1);
  if (!req) return;
  const photoId = String(form.get('photoId') ?? '') || req.photoId;
  if (photoId && /^[0-9a-f-]{36}$/i.test(photoId)) {
    await db.update(galleryPhotos).set({ status: 'removed', reviewedAt: new Date() }).where(eq(galleryPhotos.id, photoId));
    if (!req.photoId) await db.update(takedownRequests).set({ photoId }).where(eq(takedownRequests.id, id));
  }
  await db.update(takedownRequests).set({ status: 'done', resolvedAt: new Date() }).where(eq(takedownRequests.id, id));
  done();
}

export async function dismissTakedown(form: FormData): Promise<void> {
  await requireAdmin();
  await db
    .update(takedownRequests)
    .set({ status: 'done', resolvedAt: new Date() })
    .where(inArray(takedownRequests.id, [idOf(form)]));
  done();
}
