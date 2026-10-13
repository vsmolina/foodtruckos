'use server';

import * as gallery from '@/lib/admin/gallery';
import { requireAdmin } from '@/lib/auth';

// Thin wrappers: the logic lives in lib/admin/gallery.ts, shared with the
// admin API that the truck dashboard calls.

const idOf = (form: FormData): string => String(form.get('id') ?? '');

/** Approve: only possible once consent is confirmed (enforced in lib/admin/gallery). */
export async function approvePhoto(form: FormData): Promise<void> {
  await requireAdmin();
  await gallery.approvePhoto({ id: idOf(form) });
}

export async function rejectPhoto(form: FormData): Promise<void> {
  await requireAdmin();
  await gallery.rejectPhoto({ id: idOf(form) });
}

export async function removePhoto(form: FormData): Promise<void> {
  await requireAdmin();
  await gallery.removePhoto({ id: idOf(form) });
}

export async function restoreToPending(form: FormData): Promise<void> {
  await requireAdmin();
  await gallery.restoreToPending({ id: idOf(form) });
}

/** Owner confirms consent for a photo they uploaded. Requires the checkbox. */
export async function confirmConsent(form: FormData): Promise<void> {
  await requireAdmin();
  if (form.get('confirm') !== 'yes') return;
  await gallery.confirmConsent({ id: idOf(form), confirm: true });
}

export type UploadState = { ok?: number; error?: string };

export async function uploadOwnerPhotos(_prev: UploadState, form: FormData): Promise<UploadState> {
  await requireAdmin();
  const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: 'Choose at least one photo.' };
  if (files.length > 20) return { error: 'Upload 20 photos at a time at most.' };
  const caption = String(form.get('caption') ?? '').trim().slice(0, 140);
  const sizes = String(form.get('sizes') ?? '')
    .split(',')
    .map((s) => s.split('x').map(Number));
  let ok = 0;
  const errors: string[] = [];
  for (const [i, file] of files.entries()) {
    const [w, h] = sizes[i] ?? [];
    const result = await gallery.uploadOwnerPhoto(file, { caption, consentConfirmed: false, width: w || null, height: h || null });
    if (result.ok) ok++;
    else errors.push(`${file.name}: ${result.fieldErrors?.photo ?? result.error}`);
  }
  return errors.length ? { ok, error: errors.join(' ') } : { ok };
}

/** One action: unpublish the photo (if any) and close the request. */
export async function resolveTakedown(form: FormData): Promise<void> {
  await requireAdmin();
  const photoId = String(form.get('photoId') ?? '').trim();
  await gallery.resolveTakedown({ id: idOf(form), photoId: /^[0-9a-f-]{36}$/i.test(photoId) ? photoId : '' });
}

export async function dismissTakedown(form: FormData): Promise<void> {
  await requireAdmin();
  await gallery.dismissTakedown({ id: idOf(form) });
}
