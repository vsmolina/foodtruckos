'use server';

import { redirect } from 'next/navigation';
import * as specials from '@/lib/admin/specials';
import { requireAdmin } from '@/lib/auth';

// Thin wrappers: the logic lives in lib/admin/specials.ts, shared with the
// admin API that the truck dashboard calls.

export type SpecialState = { error?: string; fieldErrors?: Record<string, string> };

export async function saveSpecial(id: string | null, _prev: SpecialState, form: FormData): Promise<SpecialState> {
  await requireAdmin();
  const file = form.get('photo');
  const r = await specials.saveSpecial(
    {
      id,
      title: String(form.get('title') ?? ''),
      kicker: String(form.get('kicker') ?? ''),
      body: String(form.get('body') ?? ''),
      priceLabel: String(form.get('priceLabel') ?? ''),
      startsAt: String(form.get('startsAt') ?? ''),
      endsAt: String(form.get('endsAt') ?? ''),
      sortOrder: form.get('sortOrder') ?? 0,
      active: form.get('active') === 'on',
    },
    file instanceof File ? file : null,
  );
  if (!r.ok) return r.fieldErrors ? { error: r.error, fieldErrors: r.fieldErrors } : { error: r.error };
  redirect('/admin/specials');
}

export async function toggleSpecial(id: string, active: boolean): Promise<void> {
  await requireAdmin();
  await specials.setSpecialActive({ id, active });
}

export async function deleteSpecial(id: string): Promise<void> {
  await requireAdmin();
  await specials.deleteSpecial({ id });
  redirect('/admin/specials');
}
