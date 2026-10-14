'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ApiResult } from '@barrio/site-contract';
import { auth } from '@/auth';
import { siteApi } from '@/lib/site/api';
import { bool, str, toFormState, type FormState } from '@/lib/site/form';

// Gallery moderation. Server actions are reachable by direct POST: each
// re-checks the dashboard session; the website validates every input and
// enforces consent before anything goes public.

async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
}

const MAX_FILES = 10;

/** Where a moving action sends the owner back to (the card leaves the current view). */
export type GalleryReturn = 'pending' | 'approved' | 'removed' | 'takedowns';

/**
 * Actions that move a photo/request out of the current view would unmount the
 * form showing their result, so on success they redirect with a page-level
 * notice (see NOTICES in page.tsx). Errors stay inline on the card.
 */
function moved(result: ApiResult<unknown>, back: GalleryReturn, notice: string): FormState {
  if (!result.ok) return toFormState(result, '');
  revalidatePath('/website', 'layout');
  redirect(`/website/gallery?view=${back}&notice=${notice}`);
}

export async function confirmConsent(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return toFormState(await siteApi('gallery.confirmConsent', { id, confirm: bool(fd, 'confirm') }), 'Consent confirmed. You can approve it now.');
}

export async function approve(id: string): Promise<FormState> {
  await requireAdmin();
  return moved(await siteApi('gallery.approve', { id }), 'pending', 'approved');
}

export async function reject(id: string): Promise<FormState> {
  await requireAdmin();
  return moved(await siteApi('gallery.reject', { id }), 'pending', 'rejected');
}

export async function remove(id: string): Promise<FormState> {
  await requireAdmin();
  return moved(await siteApi('gallery.remove', { id }), 'approved', 'removed');
}

export async function restore(id: string): Promise<FormState> {
  await requireAdmin();
  return moved(await siteApi('gallery.restore', { id }), 'removed', 'restored');
}

export async function saveCaption(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return toFormState(await siteApi('gallery.setCaption', { id, caption: str(fd, 'caption', 140) }), 'Caption saved.');
}

/** One API call per photo (the API takes one file per call). */
export async function upload(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const photos = fd.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length === 0) return { error: 'Choose at least one photo.', fieldErrors: { photos: 'Choose at least one photo.' }, at: Date.now() };
  if (photos.length > MAX_FILES) return { error: `Upload ${MAX_FILES} photos at a time at most.`, at: Date.now() };
  const input = { caption: str(fd, 'caption', 140), consentConfirmed: bool(fd, 'consent') };
  let done = 0;
  const errors: string[] = [];
  for (const photo of photos) {
    const result = await siteApi('gallery.upload', input, { photo });
    if (result.ok) done++;
    else errors.push(`${photo.name}: ${result.fieldErrors?.photo ?? result.error}`);
  }
  const okText = `Uploaded ${done} photo${done === 1 ? '' : 's'}. ${input.consentConfirmed ? 'Approve to publish.' : 'Confirm consent, then approve to publish.'}`;
  if (errors.length === 0) return toFormState({ ok: true, data: null }, okText);
  if (done) toFormState({ ok: true, data: null }, okText); // still refresh the ones that made it
  return { error: `${done ? `Uploaded ${done}; ` : ''}${errors.join(' ')}`, at: Date.now() };
}

export async function resolveTakedown(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const photoId = str(fd, 'photoId', 40);
  return moved(await siteApi('gallery.resolveTakedown', photoId ? { id, photoId } : { id }), 'takedowns', 'resolved');
}

export async function dismissTakedown(id: string): Promise<FormState> {
  await requireAdmin();
  return moved(await siteApi('gallery.dismissTakedown', { id }), 'takedowns', 'dismissed');
}


/** Connect / disconnect swap the whole Instagram panel, so they report through a page notice too. */
export async function connectInstagram(back: GalleryReturn, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  // A refresh problem right after connecting shows as the panel's own error line.
  return moved(await siteApi('gallery.instagramConnect', { accessToken: str(fd, 'accessToken', 2000) }), back, 'ig-connected');
}

export async function refreshInstagram(): Promise<FormState> {
  await requireAdmin();
  return toFormState(await siteApi('gallery.instagramRefresh', {}), 'Up to date with Instagram.');
}

export async function disconnectInstagram(back: GalleryReturn): Promise<FormState> {
  await requireAdmin();
  return moved(await siteApi('gallery.instagramDisconnect', {}), back, 'ig-disconnected');
}
