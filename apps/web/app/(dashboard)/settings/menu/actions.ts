'use server';

import { and, asc, count, eq, max, ne } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db/client';
import { getStoreId, isUuid } from '@/lib/db/queries/menu';
import { menuCategories, menuItemVariations, menuItems, menuModifiers, orderItems } from '@/lib/db/schema';
import { parseDollars } from '@/lib/format';
import type { Notice } from './notices';

// Menu CRUD (our DB only in the MVP; Square Catalog stays the source of truth
// until Phase 5). Server actions are reachable by direct POST, so every one
// re-checks the admin session and validates its own inputs. Each ends in a
// redirect carrying a notice code, so the page re-renders fresh without JS.

const MENU = '/settings/menu';
const itemPath = (id: string) => `${MENU}/items/${id}`;
const go = (path: string, notice: Notice): never => redirect(`${path}?notice=${notice}`);

async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
}

function text(fd: FormData, key: string, maxLen: number): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim().slice(0, maxLen) : '';
}

const nameOf = (fd: FormData) => text(fd, 'name', 80);
const optional = (s: string): string | null => (s === '' ? null : s);

/** Price in cents from a dollars field; `allowNegative` for modifier deltas. */
function price(fd: FormData, key: string, allowNegative = false): number | null {
  const cents = parseDollars(text(fd, key, 16) || '0');
  if (cents == null || (!allowNegative && cents < 0)) return null;
  return cents;
}

async function categoryInStore(categoryId: string): Promise<boolean> {
  const storeId = await getStoreId();
  if (!storeId || !isUuid(categoryId)) return false;
  const [row] = await db
    .select({ id: menuCategories.id })
    .from(menuCategories)
    .where(and(eq(menuCategories.id, categoryId), eq(menuCategories.storeId, storeId)));
  return Boolean(row);
}

// --- Categories -------------------------------------------------------------

export async function createCategory(fd: FormData): Promise<void> {
  await requireAdmin();
  const name = nameOf(fd);
  if (!name) go(MENU, 'err_name');
  const storeId = await getStoreId();
  if (!storeId) go(MENU, 'err_not_found');

  const [last] = await db
    .select({ n: max(menuCategories.sortOrder) })
    .from(menuCategories)
    .where(eq(menuCategories.storeId, storeId!));
  await db.insert(menuCategories).values({ storeId: storeId!, name, sortOrder: (last?.n ?? -1) + 1 });
  go(MENU, 'created');
}

export async function renameCategory(id: string, fd: FormData): Promise<void> {
  await requireAdmin();
  const name = nameOf(fd);
  if (!name) go(MENU, 'err_name');
  if (!(await categoryInStore(id))) go(MENU, 'err_not_found');
  await db.update(menuCategories).set({ name }).where(eq(menuCategories.id, id));
  go(MENU, 'saved');
}

/** Swap a category with its neighbor, renumbering 0..n so gaps/dupes self-heal. */
export async function moveCategory(id: string, direction: 'up' | 'down'): Promise<void> {
  await requireAdmin();
  const storeId = await getStoreId();
  if (!storeId || !isUuid(id)) go(MENU, 'err_not_found');

  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: menuCategories.id })
      .from(menuCategories)
      .where(eq(menuCategories.storeId, storeId!))
      .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name));
    const ids = rows.map((r) => r.id);
    const i = ids.indexOf(id);
    const j = direction === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    for (const [sortOrder, cid] of ids.entries()) {
      await tx.update(menuCategories).set({ sortOrder }).where(eq(menuCategories.id, cid));
    }
  });
  go(MENU, 'saved');
}

export async function deleteCategory(id: string): Promise<void> {
  await requireAdmin();
  if (!(await categoryInStore(id))) go(MENU, 'err_not_found');
  const [items] = await db.select({ n: count() }).from(menuItems).where(eq(menuItems.categoryId, id));
  if ((items?.n ?? 0) > 0) go(MENU, 'err_not_empty');
  await db.delete(menuCategories).where(eq(menuCategories.id, id));
  go(MENU, 'deleted');
}

// --- Items --------------------------------------------------------------------

export async function createItem(fd: FormData): Promise<void> {
  await requireAdmin();
  const categoryId = text(fd, 'categoryId', 40);
  const back = `${MENU}/items/new${isUuid(categoryId) ? `?category=${categoryId}&` : '?'}`;
  const name = nameOf(fd);
  if (!name) redirect(`${back}notice=err_name`);
  const priceCents = price(fd, 'price');
  if (priceCents == null) redirect(`${back}notice=err_price`);
  if (!(await categoryInStore(categoryId))) redirect(`${back}notice=err_not_found`);

  const id = await db.transaction(async (tx) => {
    const [item] = await tx
      .insert(menuItems)
      .values({ categoryId, name, description: optional(text(fd, 'description', 500)) })
      .returning({ id: menuItems.id });
    await tx.insert(menuItemVariations).values({ itemId: item!.id, name: 'Regular', priceCents, isDefault: true });
    return item!.id;
  });
  go(itemPath(id), 'created');
}

export async function updateItem(id: string, fd: FormData): Promise<void> {
  await requireAdmin();
  if (!isUuid(id)) go(MENU, 'err_not_found');
  const name = nameOf(fd);
  if (!name) go(itemPath(id), 'err_name');
  const categoryId = text(fd, 'categoryId', 40);
  if (!(await categoryInStore(categoryId))) go(itemPath(id), 'err_not_found');

  await db
    .update(menuItems)
    .set({
      name,
      categoryId,
      description: optional(text(fd, 'description', 500)),
      sku: optional(text(fd, 'sku', 40)),
      isAvailable: fd.get('isAvailable') === 'on',
    })
    .where(eq(menuItems.id, id));
  go(itemPath(id), 'saved');
}

export async function deleteItem(id: string): Promise<void> {
  await requireAdmin();
  if (!isUuid(id)) go(MENU, 'err_not_found');
  // Past orders reference menu items; keep that history — hide the item instead.
  const [used] = await db.select({ n: count() }).from(orderItems).where(eq(orderItems.menuItemId, id));
  if ((used?.n ?? 0) > 0) go(itemPath(id), 'err_in_use');

  await db.transaction(async (tx) => {
    await tx.delete(menuModifiers).where(eq(menuModifiers.itemId, id));
    await tx.delete(menuItemVariations).where(eq(menuItemVariations.itemId, id));
    await tx.delete(menuItems).where(eq(menuItems.id, id));
  });
  go(MENU, 'deleted');
}

// --- Variations (each carries a price; exactly one is the default) -------------

async function variationItemId(id: string): Promise<string | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select({ itemId: menuItemVariations.itemId })
    .from(menuItemVariations)
    .where(eq(menuItemVariations.id, id));
  return row?.itemId ?? null;
}

export async function addVariation(itemId: string, fd: FormData): Promise<void> {
  await requireAdmin();
  if (!isUuid(itemId)) go(MENU, 'err_not_found');
  const name = nameOf(fd);
  if (!name) go(itemPath(itemId), 'err_name');
  const priceCents = price(fd, 'price');
  if (priceCents == null) go(itemPath(itemId), 'err_price');

  const [existing] = await db
    .select({ n: count() })
    .from(menuItemVariations)
    .where(eq(menuItemVariations.itemId, itemId));
  await db
    .insert(menuItemVariations)
    .values({ itemId, name, priceCents: priceCents!, isDefault: (existing?.n ?? 0) === 0 });
  go(itemPath(itemId), 'saved');
}

export async function updateVariation(id: string, fd: FormData): Promise<void> {
  await requireAdmin();
  const itemId = await variationItemId(id);
  if (!itemId) go(MENU, 'err_not_found');
  const name = nameOf(fd);
  if (!name) go(itemPath(itemId!), 'err_name');
  const priceCents = price(fd, 'price');
  if (priceCents == null) go(itemPath(itemId!), 'err_price');
  await db.update(menuItemVariations).set({ name, priceCents: priceCents! }).where(eq(menuItemVariations.id, id));
  go(itemPath(itemId!), 'saved');
}

export async function setDefaultVariation(id: string): Promise<void> {
  await requireAdmin();
  const itemId = await variationItemId(id);
  if (!itemId) go(MENU, 'err_not_found');
  await db.transaction(async (tx) => {
    await tx
      .update(menuItemVariations)
      .set({ isDefault: false })
      .where(and(eq(menuItemVariations.itemId, itemId!), ne(menuItemVariations.id, id)));
    await tx.update(menuItemVariations).set({ isDefault: true }).where(eq(menuItemVariations.id, id));
  });
  go(itemPath(itemId!), 'saved');
}

export async function deleteVariation(id: string): Promise<void> {
  await requireAdmin();
  const itemId = await variationItemId(id);
  if (!itemId) go(MENU, 'err_not_found');

  const blocked = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(menuItemVariations)
      .where(eq(menuItemVariations.itemId, itemId!))
      .orderBy(asc(menuItemVariations.priceCents));
    if (rows.length <= 1) return true; // an item always needs a price
    await tx.delete(menuItemVariations).where(eq(menuItemVariations.id, id));
    // Keep exactly one default: promote the cheapest remaining.
    if (rows.find((r) => r.id === id)?.isDefault) {
      const next = rows.find((r) => r.id !== id)!;
      await tx.update(menuItemVariations).set({ isDefault: true }).where(eq(menuItemVariations.id, next.id));
    }
    return false;
  });
  go(itemPath(itemId!), blocked ? 'err_last_variation' : 'deleted');
}

// --- Modifiers (price delta may be negative, e.g. "No cheese −$0.50") ------------

async function modifierItemId(id: string): Promise<string | null> {
  if (!isUuid(id)) return null;
  const [row] = await db.select({ itemId: menuModifiers.itemId }).from(menuModifiers).where(eq(menuModifiers.id, id));
  return row?.itemId ?? null;
}

export async function addModifier(itemId: string, fd: FormData): Promise<void> {
  await requireAdmin();
  if (!isUuid(itemId)) go(MENU, 'err_not_found');
  const name = nameOf(fd);
  if (!name) go(itemPath(itemId), 'err_name');
  const delta = price(fd, 'price', true);
  if (delta == null) go(itemPath(itemId), 'err_price');
  await db
    .insert(menuModifiers)
    .values({ itemId, name, priceCentsDelta: delta!, isRequired: fd.get('isRequired') === 'on' });
  go(itemPath(itemId), 'saved');
}

export async function updateModifier(id: string, fd: FormData): Promise<void> {
  await requireAdmin();
  const itemId = await modifierItemId(id);
  if (!itemId) go(MENU, 'err_not_found');
  const name = nameOf(fd);
  if (!name) go(itemPath(itemId!), 'err_name');
  const delta = price(fd, 'price', true);
  if (delta == null) go(itemPath(itemId!), 'err_price');
  await db
    .update(menuModifiers)
    .set({ name, priceCentsDelta: delta!, isRequired: fd.get('isRequired') === 'on' })
    .where(eq(menuModifiers.id, id));
  go(itemPath(itemId!), 'saved');
}

export async function deleteModifier(id: string): Promise<void> {
  await requireAdmin();
  const itemId = await modifierItemId(id);
  if (!itemId) go(MENU, 'err_not_found');
  await db.delete(menuModifiers).where(eq(menuModifiers.id, id));
  go(itemPath(itemId!), 'deleted');
}
