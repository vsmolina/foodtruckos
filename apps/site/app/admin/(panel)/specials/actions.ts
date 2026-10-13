'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { specials } from '@/lib/db/schema';
import { fromLocalInput } from '@/lib/format';
import { storeImage, UploadError } from '@/lib/storage';

export type SpecialState = { error?: string; fieldErrors?: Record<string, string> };

const when = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === '') return null;
    const d = fromLocalInput(v);
    if (!d) ctx.addIssue({ code: 'custom', message: 'Pick a date and time.' });
    return d;
  });

const Schema = z
  .object({
    title: z.string().trim().min(3, 'Give it a title.').max(80),
    kicker: z.string().trim().max(24),
    body: z.string().trim().max(400),
    priceLabel: z.string().trim().max(12),
    startsAt: when,
    endsAt: when,
    sortOrder: z.coerce.number().int().min(0).max(999),
    active: z.string().optional(),
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt, { message: 'Ends must be after starts.', path: ['endsAt'] });

export async function saveSpecial(id: string | null, _prev: SpecialState, form: FormData): Promise<SpecialState> {
  await requireAdmin();
  const parsed = Schema.safeParse({
    title: form.get('title') ?? '',
    kicker: form.get('kicker') ?? '',
    body: form.get('body') ?? '',
    priceLabel: form.get('priceLabel') ?? '',
    startsAt: form.get('startsAt') ?? '',
    endsAt: form.get('endsAt') ?? '',
    sortOrder: form.get('sortOrder') ?? 0,
    active: form.get('active') ?? undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: 'Check the highlighted fields.', fieldErrors };
  }
  const v = parsed.data;
  let photoUrl: string | undefined;
  const file = form.get('photo');
  if (file instanceof File && file.size > 0) {
    try {
      photoUrl = await storeImage(file, 'specials');
    } catch (err) {
      return { error: err instanceof UploadError ? err.message : 'Upload failed.' };
    }
  }
  const values = {
    title: v.title,
    kicker: v.kicker || null,
    body: v.body || null,
    priceLabel: v.priceLabel || null,
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    sortOrder: v.sortOrder,
    active: v.active === 'on',
    ...(photoUrl ? { photoUrl } : {}),
  };
  if (id) await db.update(specials).set(values).where(eq(specials.id, id));
  else await db.insert(specials).values(values);
  revalidatePath('/', 'layout');
  redirect('/admin/specials');
}

export async function toggleSpecial(id: string, active: boolean): Promise<void> {
  await requireAdmin();
  await db.update(specials).set({ active }).where(eq(specials.id, id));
  revalidatePath('/', 'layout');
}

export async function deleteSpecial(id: string): Promise<void> {
  await requireAdmin();
  await db.delete(specials).where(eq(specials.id, id));
  revalidatePath('/', 'layout');
  redirect('/admin/specials');
}
