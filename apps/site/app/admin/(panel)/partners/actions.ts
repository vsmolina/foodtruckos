'use server';

import { and, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { cleanHandle } from '@/lib/gallery/consent';
import { db } from '@/lib/db/client';
import { partners } from '@/lib/db/schema';
import { UploadError, storeImage } from '@/lib/storage';

export type PartnerFormState = {
  error?: string;
  fields?: Partial<Record<'name' | 'kind' | 'code' | 'blurb' | 'instagram' | 'url' | 'sortOrder' | 'photo', string>>;
};

const Schema = z.object({
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

export async function savePartner(_prev: PartnerFormState, form: FormData): Promise<PartnerFormState> {
  await requireAdmin();
  const id = String(form.get('id') ?? '') || null;
  const parsed = Schema.safeParse({
    name: form.get('name') ?? '',
    kind: form.get('kind') ?? 'bar',
    code: form.get('code') ?? '',
    blurb: form.get('blurb') ?? '',
    instagram: form.get('instagram') ?? '',
    url: form.get('url') ?? '',
    sortOrder: form.get('sortOrder') || 0,
    active: form.get('active') === 'yes',
  });
  if (!parsed.success) {
    const fields: PartnerFormState['fields'] = {};
    for (const i of parsed.error.issues) fields[i.path[0] as 'name'] ??= i.message;
    return { error: 'Check the highlighted fields.', fields };
  }
  const d = parsed.data;

  const [clash] = await db
    .select({ id: partners.id })
    .from(partners)
    .where(id ? and(eq(partners.code, d.code), ne(partners.id, id)) : eq(partners.code, d.code))
    .limit(1);
  if (clash) return { error: 'Check the highlighted fields.', fields: { code: 'Another partner already uses that code.' } };

  let photoUrl: string | undefined;
  const photo = form.get('photo');
  if (photo instanceof File && photo.size > 0) {
    try {
      photoUrl = await storeImage(photo, 'partners');
    } catch (err) {
      return { error: 'Check the photo.', fields: { photo: err instanceof UploadError ? err.message : 'Upload failed.' } };
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
  if (id) await db.update(partners).set(values).where(eq(partners.id, id));
  else await db.insert(partners).values(values);
  revalidatePath('/admin/partners');
  revalidatePath('/partners');
  redirect('/admin/partners');
}

export async function removePartnerPhoto(form: FormData): Promise<void> {
  await requireAdmin();
  const id = String(form.get('id') ?? '');
  await db.update(partners).set({ photoUrl: null }).where(eq(partners.id, id));
  revalidatePath(`/admin/partners/${id}`);
  revalidatePath('/partners');
}
