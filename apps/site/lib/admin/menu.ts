import 'server-only';
import { revalidatePath } from 'next/cache';
import { asc, eq, max } from 'drizzle-orm';
import { z } from 'zod';
import type { MenuItemDto, MenuOverview, MenuSyncResult } from '@barrio/site-contract';
import { db } from '@/lib/db/client';
import { menuCategories, menuItems, menuVariations } from '@/lib/db/schema';
import { has } from '@/lib/env';
import { syncMenuFromSquare } from '@/lib/square/sync';
import { storeImage, UploadError } from '@/lib/storage';
import { fail, invalid, ok, type Result } from './result';

// Website-only menu fields (Spanish labels, photo override, hidden, NEW, the
// site's sold-out toggle) and the Square pull. No auth here: callers (admin
// server actions, admin API) check it first.

const refresh = (): void => revalidatePath('/', 'layout');

export async function menuOverview(): Promise<MenuOverview> {
  const [cats, items, vars, [lastSync]] = await Promise.all([
    db.select().from(menuCategories).orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name)),
    db.select().from(menuItems).orderBy(asc(menuItems.sortOrder), asc(menuItems.name)),
    db.select().from(menuVariations).orderBy(asc(menuVariations.sortOrder), asc(menuVariations.priceCents)),
    db.select({ at: max(menuItems.syncedAt) }).from(menuItems),
  ]);
  const varsByItem = Map.groupBy(vars, (v) => v.itemId);
  const toDto = (i: typeof menuItems.$inferSelect): MenuItemDto => ({
    id: i.id,
    squareId: i.squareId,
    name: i.name,
    description: i.description,
    taglineEs: i.taglineEs,
    photoUrl: i.photoOverrideUrl ?? i.photoUrl,
    squarePhotoUrl: i.photoUrl,
    photoOverrideUrl: i.photoOverrideUrl,
    soldOut: i.soldOut,
    squareSoldOut: i.squareSoldOut,
    hidden: i.hidden,
    isNew: i.isNew,
    sortOrder: i.sortOrder,
    prices: (varsByItem.get(i.id) ?? []).map((v) => ({ name: v.name, priceCents: v.priceCents })),
  });
  const catIds = new Set(cats.map((c) => c.id));
  return {
    categories: cats.map((c) => ({
      id: c.id,
      squareId: c.squareId,
      name: c.name,
      labelEs: c.labelEs,
      sortOrder: c.sortOrder,
      hidden: c.hidden,
      items: items.filter((i) => i.categoryId === c.id).map(toDto),
    })),
    uncategorized: items.filter((i) => !i.categoryId || !catIds.has(i.categoryId)).map(toDto),
    lastSyncedAt: lastSync?.at ? lastSync.at.toISOString() : null,
    squareConfigured: has.square,
  };
}

export async function syncMenu(): Promise<Result<MenuSyncResult>> {
  if (!has.square) return fail('Square isn’t configured on the website.');
  try {
    const r = await syncMenuFromSquare();
    refresh();
    return ok(r);
  } catch (err) {
    return fail(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

const id = z.string().uuid('Unknown item.');

const FlagSchema = z.object({ id, flag: z.enum(['soldOut', 'hidden', 'isNew']), value: z.boolean() });

export async function setItemFlag(input: unknown): Promise<Result<{ id: string }>> {
  const parsed = FlagSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id: itemId, flag, value } = parsed.data;
  const [row] = await db.update(menuItems).set({ [flag]: value }).where(eq(menuItems.id, itemId)).returning({ id: menuItems.id });
  if (!row) return fail('That item no longer exists.');
  refresh();
  return ok({ id: row.id });
}

const CategorySchema = z.object({
  id,
  labelEs: z.string().trim().max(40),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export async function saveCategory(input: unknown): Promise<Result<{ id: string }>> {
  const parsed = CategorySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const p = parsed.data;
  const [row] = await db
    .update(menuCategories)
    .set({ labelEs: p.labelEs || null, sortOrder: p.sortOrder })
    .where(eq(menuCategories.id, p.id))
    .returning({ id: menuCategories.id });
  if (!row) return fail('That category no longer exists.');
  refresh();
  return ok({ id: row.id });
}

const HiddenSchema = z.object({ id, hidden: z.boolean() });

export async function setCategoryHidden(input: unknown): Promise<Result<{ id: string }>> {
  const parsed = HiddenSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const [row] = await db
    .update(menuCategories)
    .set({ hidden: parsed.data.hidden })
    .where(eq(menuCategories.id, parsed.data.id))
    .returning({ id: menuCategories.id });
  if (!row) return fail('That category no longer exists.');
  refresh();
  return ok({ id: row.id });
}

const ItemSchema = z.object({
  id,
  taglineEs: z.string().trim().max(60, 'Keep it under 60 characters.'),
  sortOrder: z.coerce.number().int().min(0).max(999),
  removePhoto: z.boolean(),
});

/** Spanish tagline, order and the website photo (`photo` replaces; `removePhoto` reverts to Square's). */
export async function saveItem(input: unknown, photo: File | null): Promise<Result<{ id: string }>> {
  const parsed = ItemSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const p = parsed.data;

  let photoOverrideUrl: string | null | undefined;
  if (photo && photo.size > 0) {
    try {
      photoOverrideUrl = await storeImage(photo, 'menu');
    } catch (err) {
      return fail(err instanceof UploadError ? err.message : 'Upload failed.', { photo: err instanceof UploadError ? err.message : 'Upload failed.' });
    }
  } else if (p.removePhoto) {
    photoOverrideUrl = null;
  }

  const [row] = await db
    .update(menuItems)
    .set({
      taglineEs: p.taglineEs || null,
      sortOrder: p.sortOrder,
      ...(photoOverrideUrl !== undefined ? { photoOverrideUrl } : {}),
    })
    .where(eq(menuItems.id, p.id))
    .returning({ id: menuItems.id });
  if (!row) return fail('That item no longer exists.');
  refresh();
  return ok({ id: row.id });
}
