'use server';

import { z } from 'zod';
import { db } from '@/lib/db/client';
import { galleryPhotos } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { SUBMIT_CONSENT, cleanHandle } from '@/lib/gallery/consent';
import { ownerContacts, sendEmail } from '@/lib/messaging/email';
import { isBot, rateLimit } from '@/lib/rate-limit';
import { UploadError, storeImage } from '@/lib/storage';

export type SubmitState = {
  ok?: boolean;
  error?: string;
  fields?: Partial<Record<'photo' | 'name' | 'email' | 'instagram' | 'caption' | 'consent_rights' | 'consent_people' | 'consent_terms', string>>;
  values?: { name?: string; email?: string; instagram?: string; caption?: string };
};

const Schema = z.object({
  name: z.string().trim().min(1, 'Tell us your name.').max(80),
  email: z.string().trim().email('Enter a valid email so we can reach you.').max(200),
  instagram: z
    .string()
    .trim()
    .max(60)
    .transform(cleanHandle)
    .refine((h) => h === '' || /^[A-Za-z0-9._]{1,30}$/.test(h), 'That doesn’t look like an Instagram handle.'),
  caption: z.string().trim().max(140, 'Keep the caption under 140 characters.'),
  consent_rights: z.literal('yes', { error: 'Please confirm you can share this photo.' }),
  consent_people: z.literal('yes', { error: 'We only post people who agreed to it.' }),
  consent_terms: z.literal('yes', { error: 'Please agree to the photo terms.' }),
});

export async function submitPhoto(_prev: SubmitState, form: FormData): Promise<SubmitState> {
  // Bots get a fake success so they don't retry.
  if (isBot(form)) return { ok: true };

  const raw = {
    name: String(form.get('name') ?? ''),
    email: String(form.get('email') ?? ''),
    instagram: String(form.get('instagram') ?? ''),
    caption: String(form.get('caption') ?? ''),
    consent_rights: form.get('consent_rights') ?? undefined,
    consent_people: form.get('consent_people') ?? undefined,
    consent_terms: form.get('consent_terms') ?? undefined,
  };
  const values = { name: raw.name, email: raw.email, instagram: raw.instagram, caption: raw.caption };
  const parsed = Schema.safeParse(raw);
  const fields: SubmitState['fields'] = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const k = issue.path[0] as keyof NonNullable<SubmitState['fields']>;
      fields[k] ??= issue.message;
    }
  }
  const file = form.get('photo');
  if (!(file instanceof File) || file.size === 0) fields.photo = 'Choose a photo to upload.';
  if (Object.keys(fields).length > 0 || !parsed.success) {
    return { error: 'Check the highlighted fields.', fields, values };
  }

  if (!(await rateLimit('gallery-submit', 5, 60 * 60))) {
    return { error: 'That’s a lot of photos — try again in an hour.', values };
  }

  let url: string;
  try {
    url = await storeImage(file as File, 'gallery');
  } catch (err) {
    if (err instanceof UploadError) return { error: 'Check the photo.', fields: { photo: err.message }, values };
    console.error('[gallery] upload failed', err);
    return { error: 'Upload failed. Please try again.', values };
  }

  const width = Number(form.get('width')) || null;
  const height = Number(form.get('height')) || null;
  const d = parsed.data;
  const [row] = await db
    .insert(galleryPhotos)
    .values({
      url,
      width: width && width < 20000 ? width : null,
      height: height && height < 20000 ? height : null,
      caption: d.caption || null,
      source: 'submission',
      status: 'pending',
      submitterName: d.name,
      submitterEmail: d.email,
      submitterInstagram: d.instagram || null,
      consentConfirmed: true,
      consentBy: 'submitter',
      consentText: [SUBMIT_CONSENT.rights, SUBMIT_CONSENT.people, SUBMIT_CONSENT.terms].join(' '),
      consentAt: new Date(),
    })
    .returning({ id: galleryPhotos.id });

  const owner = ownerContacts();
  if (owner.email) {
    await sendEmail({
      to: owner.email,
      subject: 'New photo for the gallery',
      text: `${d.name} (${d.email}${d.instagram ? `, @${d.instagram}` : ''}) sent a photo${d.caption ? `: “${d.caption}”` : ''}.\n\nReview it: ${env.siteUrl}/admin/gallery\n\nPhoto id: ${row?.id}`,
      replyTo: d.email,
    });
  }
  return { ok: true };
}
