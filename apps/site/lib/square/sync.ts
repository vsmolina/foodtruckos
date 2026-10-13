import 'server-only';
import { and, eq, isNull, notInArray, sql } from 'drizzle-orm';
import type * as Square from 'square';
import { db } from '@/lib/db/client';
import { menuCategories, menuItems, menuModifiers, menuVariations } from '@/lib/db/schema';
import { SQ, squareClient, squareLocationId } from './client';

// Pull the Square catalog into the site's menu cache. Square wins for names,
// descriptions, prices, sizes, modifiers and its photo; web-only fields
// (Spanish labels, photo override, hidden, NEW, the site's sold-out toggle)
// are never touched. Rows that exist only locally (seed placeholders) are
// adopted by name on the first sync, otherwise hidden. Items deleted or
// archived in Square are hidden, never deleted (old web orders keep their
// snapshot either way).

type Obj = Square.CatalogObject;

const num = (v: bigint | number | null | undefined): number => (v == null ? 0 : Number(v));
const norm = (s: string) => s.trim().toLowerCase();

export type SyncResult = { categories: number; items: number; removed: number };

let lastSyncAt = 0;
/** For webhooks: skip if a sync ran in the last `seconds`. */
export function syncedWithin(seconds: number): boolean {
  return Date.now() - lastSyncAt < seconds * 1000;
}

export async function syncMenuFromSquare(): Promise<SyncResult> {
  lastSyncAt = Date.now();
  const locationId = squareLocationId();
  const all: Obj[] = [];
  for await (const o of await squareClient().catalog.list({ types: 'CATEGORY,ITEM,MODIFIER_LIST,IMAGE' }, SQ)) all.push(o);

  const live = <T extends Obj>(type: Obj['type']) => all.filter((o): o is T => o.type === type && !o.isDeleted);
  const sqCategories = live<Square.CatalogObject.Category>('CATEGORY');
  const sqItems = live<Square.CatalogObject.Item>('ITEM').filter(
    (i) => !i.itemData?.isArchived && (i.presentAtAllLocations || i.presentAtLocationIds?.includes(locationId)),
  );
  const lists = new Map(live<Square.CatalogObject.ModifierList>('MODIFIER_LIST').map((l) => [l.id!, l]));
  const images = new Map(live<Square.CatalogObject.Image>('IMAGE').map((i) => [i.id!, i.imageData?.url ?? null]));

  const now = new Date();
  const result: SyncResult = { categories: 0, items: 0, removed: 0 };

  await db.transaction(async (tx) => {
    // ---- categories ----
    const localCats = await tx.select().from(menuCategories);
    const catIdBySquare = new Map<string, string>();
    for (const [i, c] of sqCategories.entries()) {
      const name = c.categoryData?.name?.trim() || 'Menu';
      const existing =
        localCats.find((l) => l.squareId === c.id) ?? localCats.find((l) => !l.squareId && norm(l.name) === norm(name));
      if (existing) {
        await tx.update(menuCategories).set({ name, squareId: c.id! }).where(eq(menuCategories.id, existing.id));
        existing.squareId = c.id!;
        catIdBySquare.set(c.id!, existing.id);
      } else {
        const [row] = await tx
          .insert(menuCategories)
          .values({ name, squareId: c.id!, sortOrder: 100 + i })
          .returning({ id: menuCategories.id });
        catIdBySquare.set(c.id!, row!.id);
      }
      result.categories++;
    }

    let fallback: string | null = null;
    const fallbackCategory = async (): Promise<string> => {
      if (fallback) return fallback;
      const found = localCats.find((l) => norm(l.name) === 'more');
      fallback = found?.id ?? (await tx.insert(menuCategories).values({ name: 'More', sortOrder: 999 }).returning({ id: menuCategories.id }))[0]!.id;
      return fallback;
    };

    // ---- items ----
    const localItems = await tx.select().from(menuItems);
    const keepItems: string[] = [];
    for (const it of sqItems) {
      const d = it.itemData ?? {};
      const name = d.name?.trim() || 'Untitled';
      const sqCat = d.categories?.[0]?.id ?? d.reportingCategory?.id ?? d.categoryId;
      const categoryId = (sqCat && catIdBySquare.get(sqCat)) || (await fallbackCategory());
      const variations = (d.variations ?? []).filter(
        (v): v is Square.CatalogObject.ItemVariation => v.type === 'ITEM_VARIATION' && !v.isDeleted,
      );
      // Sold out at this location when every variation is.
      const soldOut =
        variations.length > 0 &&
        variations.every((v) => v.itemVariationData?.locationOverrides?.some((o) => o.locationId === locationId && o.soldOut));
      const photoUrl = (d.imageIds ?? []).map((id) => images.get(id)).find(Boolean) ?? null;
      const values = {
        categoryId,
        name,
        description: d.descriptionPlaintext ?? d.description ?? null,
        photoUrl,
        squareId: it.id!,
        squareSoldOut: soldOut,
        syncedAt: now,
      };

      const existing =
        localItems.find((l) => l.squareId === it.id) ?? localItems.find((l) => !l.squareId && norm(l.name) === norm(name));
      let itemId: string;
      if (existing) {
        // An item Square brings back un-hides only if *Square* hid it (it had no square_id match before = adopted).
        await tx.update(menuItems).set(values).where(eq(menuItems.id, existing.id));
        existing.squareId = it.id!;
        itemId = existing.id;
      } else {
        itemId = (await tx.insert(menuItems).values({ ...values, sortOrder: 100 + result.items }).returning({ id: menuItems.id }))[0]!.id;
      }
      keepItems.push(itemId);
      result.items++;

      // Variations: Square is the truth for this item.
      const localVars = await tx.select().from(menuVariations).where(eq(menuVariations.itemId, itemId));
      const keepVars: string[] = [];
      for (const [i, v] of variations.entries()) {
        const vd = v.itemVariationData ?? {};
        const vName = vd.name?.trim() || 'Regular';
        const vals = { itemId, name: vName, priceCents: num(vd.priceMoney?.amount), squareId: v.id!, sortOrder: i };
        const ev = localVars.find((l) => l.squareId === v.id) ?? localVars.find((l) => !l.squareId && norm(l.name) === norm(vName));
        if (ev) {
          await tx.update(menuVariations).set(vals).where(eq(menuVariations.id, ev.id));
          keepVars.push(ev.id);
        } else {
          keepVars.push((await tx.insert(menuVariations).values(vals).returning({ id: menuVariations.id }))[0]!.id);
        }
      }
      await tx
        .delete(menuVariations)
        .where(and(eq(menuVariations.itemId, itemId), keepVars.length ? notInArray(menuVariations.id, keepVars) : undefined));

      // Modifiers, grouped by Square modifier list.
      const keepMods: string[] = [];
      let sort = 0;
      const localMods = await tx.select().from(menuModifiers).where(eq(menuModifiers.itemId, itemId));
      for (const info of d.modifierListInfo ?? []) {
        if (info.enabled === false || !info.modifierListId) continue;
        const list = lists.get(info.modifierListId);
        if (!list) continue;
        const ld = list.modifierListData ?? {};
        const single = ld.selectionType === 'SINGLE';
        const max = info.maxSelectedModifiers != null && info.maxSelectedModifiers >= 0 ? info.maxSelectedModifiers : single ? 1 : null;
        const required = (info.minSelectedModifiers ?? 0) > 0;
        for (const m of ld.modifiers ?? []) {
          if (m.type !== 'MODIFIER' || m.isDeleted || !m.id) continue;
          const mName = m.modifierData?.name?.trim() || 'Option';
          const vals = {
            itemId,
            squareId: m.id,
            groupName: ld.name?.trim() || 'Options',
            groupMax: max,
            groupRequired: required,
            name: mName,
            priceCents: num(m.modifierData?.priceMoney?.amount),
            sortOrder: sort++,
          };
          const em = localMods.find((l) => l.squareId === m.id) ?? localMods.find((l) => !l.squareId && norm(l.name) === norm(mName));
          if (em) {
            await tx.update(menuModifiers).set(vals).where(eq(menuModifiers.id, em.id));
            keepMods.push(em.id);
          } else {
            keepMods.push((await tx.insert(menuModifiers).values(vals).returning({ id: menuModifiers.id }))[0]!.id);
          }
        }
      }
      await tx
        .delete(menuModifiers)
        .where(and(eq(menuModifiers.itemId, itemId), keepMods.length ? notInArray(menuModifiers.id, keepMods) : undefined));
    }

    // Everything Square no longer has (or never had) is hidden, not deleted.
    const hidden = await tx
      .update(menuItems)
      .set({ hidden: true })
      .where(and(eq(menuItems.hidden, false), keepItems.length ? notInArray(menuItems.id, keepItems) : undefined))
      .returning({ id: menuItems.id });
    result.removed = hidden.length;

    // Local-only categories left with no items are hidden too.
    await tx
      .update(menuCategories)
      .set({ hidden: true })
      .where(
        and(
          isNull(menuCategories.squareId),
          sql`not exists (select 1 from menu_items i where i.category_id = ${menuCategories.id} and i.hidden = false)`,
        ),
      );
  });

  return result;
}
