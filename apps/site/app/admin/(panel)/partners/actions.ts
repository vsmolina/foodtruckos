'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as partners from '@/lib/admin/partners';
import { requireAdmin } from '@/lib/auth';

// Thin wrappers: the logic lives in lib/admin/partners.ts, shared with the
// admin API that the truck dashboard calls.

export type PartnerFormState = {
  error?: string;
  fields?: Partial<Record<'name' | 'kind' | 'code' | 'blurb' | 'instagram' | 'url' | 'sortOrder' | 'photo', string>>;
};

export async function savePartner(_prev: PartnerFormState, form: FormData): Promise<PartnerFormState> {
  await requireAdmin();
  const photo = form.get('photo');
  const result = await partners.savePartner(
    {
      id: String(form.get('id') ?? '') || null,
      name: form.get('name') ?? '',
      kind: form.get('kind') ?? 'bar',
      code: form.get('code') ?? '',
      blurb: form.get('blurb') ?? '',
      instagram: form.get('instagram') ?? '',
      url: form.get('url') ?? '',
      sortOrder: form.get('sortOrder') || 0,
      active: form.get('active') === 'yes',
    },
    photo instanceof File && photo.size > 0 ? photo : null,
  );
  if (!result.ok) return { error: result.error, ...(result.fieldErrors ? { fields: result.fieldErrors } : {}) };
  redirect('/admin/partners');
}

export async function removePartnerPhoto(form: FormData): Promise<void> {
  await requireAdmin();
  const id = String(form.get('id') ?? '');
  await partners.removePartnerPhoto({ id });
  revalidatePath(`/admin/partners/${id}`);
}
