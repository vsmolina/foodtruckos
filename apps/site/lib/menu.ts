import 'server-only';
import { and, asc, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { menuCategories, menuItems, menuModifiers, menuVariations, specials } from '@/lib/db/schema';

export type MenuVariation = { id: string; name: string; priceCents: number };
export type MenuModifierGroup = {
  name: string;
  max: number | null;
  required: boolean;
  options: Array<{ id: string; name: string; priceCents: number }>;
};
export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  taglineEs: string | null;
  photoUrl: string | null;
  soldOut: boolean;
  isNew: boolean;
  variations: MenuVariation[];
  modifierGroups: MenuModifierGroup[];
  fromCents: number;
};
export type MenuCategory = { id: string; name: string; labelEs: string | null; items: MenuItem[] };

/** The public menu: visible categories → visible items, with prices and options. */
export async function getMenu(): Promise<MenuCategory[]> {
  const [cats, items, vars, mods] = await Promise.all([
    db.select().from(menuCategories).where(eq(menuCategories.hidden, false)).orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name)),
    db.select().from(menuItems).where(eq(menuItems.hidden, false)).orderBy(asc(menuItems.sortOrder), asc(menuItems.name)),
    db.select().from(menuVariations).orderBy(asc(menuVariations.sortOrder), asc(menuVariations.priceCents)),
    db.select().from(menuModifiers).orderBy(asc(menuModifiers.sortOrder), asc(menuModifiers.name)),
  ]);

  const varsByItem = Map.groupBy(vars, (v) => v.itemId);
  const modsByItem = Map.groupBy(mods, (m) => m.itemId);

  const toItem = (i: (typeof items)[number]): MenuItem | null => {
    const variations = (varsByItem.get(i.id) ?? []).map((v) => ({ id: v.id, name: v.name, priceCents: v.priceCents }));
    if (variations.length === 0) return null;
    const groups = new Map<string, MenuModifierGroup>();
    for (const m of modsByItem.get(i.id) ?? []) {
      const g = groups.get(m.groupName) ?? { name: m.groupName, max: m.groupMax, required: m.groupRequired, options: [] };
      g.options.push({ id: m.id, name: m.name, priceCents: m.priceCents });
      groups.set(m.groupName, g);
    }
    return {
      id: i.id,
      name: i.name,
      description: i.description,
      taglineEs: i.taglineEs,
      photoUrl: i.photoOverrideUrl ?? i.photoUrl,
      soldOut: i.soldOut || i.squareSoldOut,
      isNew: i.isNew,
      variations,
      modifierGroups: [...groups.values()],
      fromCents: Math.min(...variations.map((v) => v.priceCents)),
    };
  };

  const byCat = Map.groupBy(items, (i) => i.categoryId ?? 'none');
  return cats
    .map((c) => ({
      id: c.id,
      name: c.name,
      labelEs: c.labelEs,
      items: (byCat.get(c.id) ?? []).map(toItem).filter((x): x is MenuItem => x !== null),
    }))
    .filter((c) => c.items.length > 0);
}

export type Special = typeof specials.$inferSelect;

/** Active specials whose window includes now. */
export async function getActiveSpecials(): Promise<Special[]> {
  const now = new Date();
  return db
    .select()
    .from(specials)
    .where(
      and(
        eq(specials.active, true),
        or(isNull(specials.startsAt), lte(specials.startsAt, now)),
        or(isNull(specials.endsAt), gt(specials.endsAt, now)),
      ),
    )
    .orderBy(asc(specials.sortOrder), asc(specials.createdAt));
}
