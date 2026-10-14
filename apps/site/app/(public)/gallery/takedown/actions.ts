'use server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { galleryPhotos, takedownRequests } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { ownerContacts, sendEmail } from '@/lib/messaging/email';
import { sendSms } from '@/lib/messaging/sms';
import { isBot, rateLimit } from '@/lib/rate-limit';

export type TakedownState = {
  ok?: boolean;
  error?: string;
  fields?: Partial<Record<'name' | 'email' | 'description' | 'reason', string>>;
  values?: { name?: string; email?: string; description?: string; reason?: string };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Schema = z.object({
  name: z.string().trim().min(1, 'Tell us your name.').max(80),
  email: z.string().trim().email('Enter a valid email so we can confirm.').max(200),
  photoId: z.string().trim(),
  description: z.string().trim().max(500),
  reason: z.string().trim().max(1000),
});

export async function requestTakedown(_prev: TakedownState, form: FormData): Promise<TakedownState> {
  if (isBot(form)) return { ok: true };
  const raw = {
    name: String(form.get('name') ?? ''),
    email: String(form.get('email') ?? ''),
    photoId: String(form.get('photoId') ?? ''),
    description: String(form.get('description') ?? ''),
    reason: String(form.get('reason') ?? ''),
  };
  const values = { name: raw.name, email: raw.email, description: raw.description, reason: raw.reason };
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    const fields: TakedownState['fields'] = {};
    for (const i of parsed.error.issues) fields[i.path[0] as 'name'] ??= i.message;
    return { error: 'Check the highlighted fields.', fields, values };
  }
  const d = parsed.data;

  let photoId: string | null = null;
  if (UUID.test(d.photoId)) {
    const [p] = await db.select({ id: galleryPhotos.id }).from(galleryPhotos).where(eq(galleryPhotos.id, d.photoId)).limit(1);
    photoId = p?.id ?? null;
  }
  if (!photoId && !d.description) {
    return { error: 'Tell us which photo.', fields: { description: 'Describe the photo (or open it in the gallery and tap “Request removal”).' }, values };
  }

  if (!(await rateLimit('gallery-takedown', 5, 60 * 60))) {
    return { error: 'Too many requests — try again in an hour, or DM us on Instagram.', values };
  }

  await db.insert(takedownRequests).values({
    photoId,
    description: d.description || null,
    name: d.name,
    email: d.email,
    reason: d.reason || null,
  });

  const owner = ownerContacts();
  const summary = `Takedown request from ${d.name} (${d.email})${photoId ? ` for photo ${photoId}` : ''}${d.description ? `: ${d.description}` : ''}.`;
  if (owner.email) {
    await sendEmail({
      to: owner.email,
      subject: 'Photo takedown request',
      text: `${summary}\n\nReason: ${d.reason || '(none given)'}\n\nHandle it: ${env.siteUrl}/admin/gallery?tab=takedowns`,
      replyTo: d.email,
    });
  }
  if (owner.phone) await sendSms(owner.phone, `Barrio: photo takedown request from ${d.name}. ${env.siteUrl}/admin/gallery?tab=takedowns`);
  await sendEmail({
    to: d.email,
    subject: 'We got your photo removal request',
    text: `Hi ${d.name},\n\nWe got your request to take a photo down from the Barrio Burger Co. gallery. We’ll review it and remove the photo as soon as we can — usually within a day.\n\n— Barrio Burger Co.`,
  });
  return { ok: true };
}
