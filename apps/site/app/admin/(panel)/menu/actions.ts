'use server';

import { redirect } from 'next/navigation';
import * as menu from '@/lib/admin/menu';
import { requireAdmin } from '@/lib/auth';

// Thin wrappers: the logic lives in lib/admin/menu.ts, shared with the admin
// API that the truck dashboard calls.

export type MenuActionState = { ok?: string; error?: string };

export async function syncFromSquare(): Promise<MenuActionState> {
  await requireAdmin();
  const r = await menu.syncMenu();
  if (!r.ok) return { error: r.error };
  const { items, categories, removed } = r.data;
  return { ok: `Synced ${items} items in ${categories} categories from Square${removed ? `; ${removed} no longer in Square were hidden` : ''}.` };
}

type Flag = 'soldOut' | 'hidden' | 'isNew';

export async function toggleItemFlag(id: string, flag: Flag, value: boolean): Promise<void> {
  await requireAdmin();
  await menu.setItemFlag({ id, flag, value });
}

export async function toggleCategoryHidden(id: string, hidden: boolean): Promise<void> {
  await requireAdmin();
  await menu.setCategoryHidden({ id, hidden });
}

export async function saveCategory(form: FormData): Promise<void> {
  await requireAdmin();
  const r = await menu.saveCategory(Object.fromEntries(form));
  if (!r.ok) throw new Error(r.error);
}

export async function saveItem(id: string, _prev: MenuActionState, form: FormData): Promise<MenuActionState> {
  await requireAdmin();
  const file = form.get('photo');
  const r = await menu.saveItem(
    {
      id,
      taglineEs: String(form.get('taglineEs') ?? ''),
      sortOrder: form.get('sortOrder') ?? 0,
      removePhoto: form.get('removePhoto') === 'on',
    },
    file instanceof File ? file : null,
  );
  if (!r.ok) return { error: r.fieldErrors ? (Object.values(r.fieldErrors)[0] ?? r.error) : r.error };
  redirect('/admin/menu?saved=1');
}
