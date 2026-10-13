'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { menuCategories, menuItems } from '@/lib/db/schema';
import { syncMenuFromSquare } from '@/lib/square/sync';
import { storeImage, UploadError } from '@/lib/storage';

export type MenuActionState = { ok?: string; error?: string };

function refresh(): void {
  revalidatePath('/', 'layout');
}

export async function syncFromSquare(): Promise<MenuActionState> {
  await requireAdmin();
  try {
    const r = await syncMenuFromSquare();
    refresh();
    return { ok: `Synced ${r.items} items in ${r.categories} categories from Square${r.removed ? `; ${r.removed} no longer in Square were hidden` : ''}.` };
  } catch (err) {
    return { error: `Sync failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

type Flag = 'soldOut' | 'hidden' | 'isNew';

export async function toggleItemFlag(id: string, flag: Flag, value: boolean): Promise<void> {
  await requireAdmin();
  await db.update(menuItems).set({ [flag]: value }).where(eq(menuItems.id, id));
  refresh();
}

export async function toggleCategoryHidden(id: string, hidden: boolean): Promise<void> {
  await requireAdmin();
  await db.update(menuCategories).set({ hidden }).where(eq(menuCategories.id, id));
  refresh();
}

const CategorySchema = z.object({
  id: z.string().uuid(),
  labelEs: z.string().trim().max(40),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export async function saveCategory(form: FormData): Promise<void> {
  await requireAdmin();
  const p = CategorySchema.parse(Object.fromEntries(form));
  await db
    .update(menuCategories)
    .set({ labelEs: p.labelEs || null, sortOrder: p.sortOrder })
    .where(eq(menuCategories.id, p.id));
  refresh();
}

const ItemSchema = z.object({
  taglineEs: z.string().trim().max(60),
  sortOrder: z.coerce.number().int().min(0).max(999),
  removePhoto: z.string().optional(),
});

export async function saveItem(id: string, _prev: MenuActionState, form: FormData): Promise<MenuActionState> {
  await requireAdmin();
  const parsed = ItemSchema.safeParse({
    taglineEs: form.get('taglineEs') ?? '',
    sortOrder: form.get('sortOrder') ?? 0,
    removePhoto: form.get('removePhoto') ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };

  let photoOverrideUrl: string | null | undefined;
  const file = form.get('photo');
  if (file instanceof File && file.size > 0) {
    try {
      photoOverrideUrl = await storeImage(file, 'menu');
    } catch (err) {
      return { error: err instanceof UploadError ? err.message : 'Upload failed.' };
    }
  } else if (parsed.data.removePhoto === 'on') {
    photoOverrideUrl = null;
  }

  await db
    .update(menuItems)
    .set({
      taglineEs: parsed.data.taglineEs || null,
      sortOrder: parsed.data.sortOrder,
      ...(photoOverrideUrl !== undefined ? { photoOverrideUrl } : {}),
    })
    .where(eq(menuItems.id, id));
  refresh();
  redirect('/admin/menu?saved=1');
}
