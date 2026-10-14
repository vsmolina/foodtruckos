import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { menuCategories, menuItemVariations, menuItems, menuModifiers, stores } from '@/lib/db/schema';

// Menu reads for /settings/menu. MVP: our DB only — the Square Catalog stays the
// source of truth until Phase 5 two-way sync. Single store.

export type Category = typeof menuCategories.$inferSelect;
export type Item = typeof menuItems.$inferSelect;
export type Variation = typeof menuItemVariations.$inferSelect;
export type Modifier = typeof menuModifiers.$inferSelect;

export type MenuCategory = Category & {
  items: (Item & { variations: Variation[]; modifierCount: number })[];
};

/** The single store (MVP). */
export async function getStoreId(): Promise<string | null> {
  const [row] = await db.select({ id: stores.id }).from(stores).limit(1);
  return row?.id ?? null;
}

/** When the Square catalog was last pulled into our menu (null = never). */
export async function getCatalogPulledAt(): Promise<Date | null> {
  const [row] = await db.select({ at: stores.catalogPulledAt }).from(stores).limit(1);
  return row?.at ?? null;
}

/** Every category in display order, with its items (by name) and their variations. */
export async function getMenu(): Promise<MenuCategory[]> {
  const storeId = await getStoreId();
  if (!storeId) return [];

  const categories = await db
    .select()
    .from(menuCategories)
    .where(eq(menuCategories.storeId, storeId))
    .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name));
  if (categories.length === 0) return [];

  const items = await db
    .select()
    .from(menuItems)
    .where(inArray(menuItems.categoryId, categories.map((c) => c.id)))
    .orderBy(asc(menuItems.name));
  const itemIds = items.map((i) => i.id);

  const [variations, modifiers] = itemIds.length
    ? await Promise.all([
        db
          .select()
          .from(menuItemVariations)
          .where(inArray(menuItemVariations.itemId, itemIds))
          .orderBy(asc(menuItemVariations.priceCents)),
        db
          .select({ itemId: menuModifiers.itemId })
          .from(menuModifiers)
          .where(inArray(menuModifiers.itemId, itemIds)),
      ])
    : [[], []];

  return categories.map((c) => ({
    ...c,
    items: items
      .filter((i) => i.categoryId === c.id)
      .map((i) => ({
        ...i,
        variations: variations.filter((v) => v.itemId === i.id),
        modifierCount: modifiers.filter((m) => m.itemId === i.id).length,
      })),
  }));
}

export type MenuItemDetail = Item & { variations: Variation[]; modifiers: Modifier[] };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string): boolean => UUID_RE.test(s);

/** One item with its variations (by price) and modifiers (by name). null if unknown/malformed id. */
export async function getMenuItem(id: string): Promise<MenuItemDetail | null> {
  if (!isUuid(id)) return null;
  const [item] = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1);
  if (!item) return null;
  const [variations, modifiers] = await Promise.all([
    db
      .select()
      .from(menuItemVariations)
      .where(eq(menuItemVariations.itemId, id))
      .orderBy(asc(menuItemVariations.priceCents), asc(menuItemVariations.name)),
    db.select().from(menuModifiers).where(eq(menuModifiers.itemId, id)).orderBy(asc(menuModifiers.name)),
  ]);
  return { ...item, variations, modifiers };
}

/** Categories for a select, in display order. */
export async function getCategories(): Promise<Category[]> {
  const storeId = await getStoreId();
  if (!storeId) return [];
  return db
    .select()
    .from(menuCategories)
    .where(eq(menuCategories.storeId, storeId))
    .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name));
}
