import { randomUUID } from 'node:crypto';
import { and, asc, count, eq, inArray, isNotNull, max, notInArray } from 'drizzle-orm';
import type * as Square from 'square';
import { db } from '@/lib/db/client';
import {
  menuCategories,
  menuItemVariations,
  menuItems,
  menuModifiers,
  orderItems,
  stores,
} from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { squareClient } from './client';

// Two-way menu sync with the Square Catalog (Phase 5).
//
// Square's shape: an ITEM nests its ITEM_VARIATIONs (which carry the price);
// modifiers live in MODIFIER_LISTs linked from the item. Each push sends the
// item's complete current state — Square deletes nested variations/modifiers
// that are left out (verified in sandbox), so local deletes propagate for free.
//
// Square does NOT reject a stale `version` on upsert (verified in sandbox), so
// this is last-write-wins. "Pull from Square" is the way to take edits made on
// the POS/dashboard. Versions are still stored and sent, per the spec.

// Catalog batch calls carry a whole item graph; allow a little more than the 5s
// used for single-object calls.
const OPTS = { timeoutInSeconds: 10 } as const;
const CURRENCY = 'USD' as const;

type Obj = Square.CatalogObject;
const money = (cents: number) => ({ amount: BigInt(cents), currency: CURRENCY });
const num = (v: bigint | number | null | undefined): number | null => (v == null ? null : Number(v));

/** Refuse writes to a production catalog until it has been pulled at least once. */
export class PullRequiredError extends Error {
  constructor() {
    super('Pull from Square before pushing: production catalog has never been imported.');
    this.name = 'PullRequiredError';
  }
}

async function assertPushAllowed(): Promise<void> {
  if (process.env.SQUARE_ENVIRONMENT !== 'production') return;
  const [store] = await db.select({ pulledAt: stores.catalogPulledAt }).from(stores).limit(1);
  if (!store?.pulledAt) throw new PullRequiredError();
}

/** Best-effort message from a Square SDK error (it carries an `errors` array). */
export function squareErrorMessage(err: unknown): string {
  const e = err as { errors?: { code?: string; detail?: string }[]; message?: string };
  const detail = e.errors?.map((x) => [x.code, x.detail].filter(Boolean).join(': ')).join('; ');
  return (detail || e.message || String(err)).slice(0, 500);
}

// --- Push -----------------------------------------------------------------------

/** Push one category (name only — Square categories have no sort order here). */
export async function pushCategory(categoryId: string): Promise<void> {
  await assertPushAllowed();
  const [cat] = await db.select().from(menuCategories).where(eq(menuCategories.id, categoryId));
  if (!cat) return; // deleted since the job was queued

  const res = await squareClient().catalog.object.upsert(
    {
      idempotencyKey: randomUUID(),
      object: {
        type: 'CATEGORY',
        id: cat.squareId ?? '#category',
        ...(cat.squareVersion != null ? { version: BigInt(cat.squareVersion) } : {}),
        categoryData: { name: cat.name },
      } as Obj,
    },
    OPTS,
  );
  const saved = res.catalogObject;
  if (!saved?.id) throw new Error('Square returned no category');
  await db
    .update(menuCategories)
    .set({ squareId: saved.id, squareVersion: num(saved.version), syncStatus: 'synced', syncError: null, syncedAt: new Date() })
    .where(eq(menuCategories.id, cat.id));
}

/**
 * Push one item with its variations and modifier lists in a single batch
 * (creating its category first if that was never pushed), then store the
 * returned Square ids + versions on our rows.
 */
export async function pushItem(itemId: string): Promise<void> {
  await assertPushAllowed();
  const [item] = await db.select().from(menuItems).where(eq(menuItems.id, itemId));
  if (!item) return; // deleted since the job was queued

  let [cat] = await db.select().from(menuCategories).where(eq(menuCategories.id, item.categoryId));
  if (cat && !cat.squareId) {
    await pushCategory(cat.id);
    [cat] = await db.select().from(menuCategories).where(eq(menuCategories.id, cat.id));
  }

  const [variations, modifiers] = await Promise.all([
    db
      .select()
      .from(menuItemVariations)
      .where(eq(menuItemVariations.itemId, itemId))
      .orderBy(asc(menuItemVariations.priceCents)),
    db.select().from(menuModifiers).where(eq(menuModifiers.itemId, itemId)).orderBy(asc(menuModifiers.name)),
  ]);
  if (variations.length === 0) throw new Error('item has no variations; Square requires at least one');

  const itemRef = item.squareId ?? '#item';
  const version = (v: number | null) => (v != null ? { version: BigInt(v) } : {});
  // Default variation first; Square shows variations in `ordinal` order.
  const ordered = [...variations].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));

  // Our modifiers are per item, flagged required or not. Square's "required" is
  // per list, so each item gets up to two lists: optional extras (pick any) and
  // required choices (pick exactly one).
  const groups = [
    { key: 'opt', mods: modifiers.filter((m) => !m.isRequired), name: item.name, required: false },
    { key: 'req', mods: modifiers.filter((m) => m.isRequired), name: `${item.name} (choose one)`, required: true },
  ].filter((g) => g.mods.length > 0);

  const lists = groups.map((g) => {
    // Reuse the list the group's modifiers already belong to, if any.
    const existing = g.mods.find((m) => m.squareModifierListId);
    const id = existing?.squareModifierListId ?? `#list-${g.key}`;
    return {
      ...g,
      id,
      object: {
        type: 'MODIFIER_LIST',
        id,
        ...version(existing?.squareModifierListVersion ?? null),
        modifierListData: {
          name: g.name,
          selectionType: g.required ? 'SINGLE' : 'MULTIPLE',
          // A modifier keeps its Square id only within the same list; one that
          // moved between optional/required is recreated in its new list.
          modifiers: g.mods.map((m, i) => ({
            type: 'MODIFIER',
            id: m.squareId && m.squareModifierListId === id ? m.squareId : `#mod-${m.id}`,
            ...(m.squareId && m.squareModifierListId === id ? version(m.squareVersion) : {}),
            modifierData: { name: m.name, priceMoney: money(m.priceCentsDelta), ordinal: i },
          })),
        },
      } as Obj,
    };
  });

  const itemObject = {
    type: 'ITEM',
    id: itemRef,
    ...version(item.squareVersion),
    presentAtAllLocations: true,
    itemData: {
      name: item.name,
      description: item.description ?? undefined,
      isArchived: !item.isAvailable,
      ...(cat?.squareId ? { categories: [{ id: cat.squareId }], reportingCategory: { id: cat.squareId } } : {}),
      modifierListInfo: lists.map((l) => ({
        modifierListId: l.id,
        enabled: true,
        minSelectedModifiers: l.required ? 1 : 0,
        maxSelectedModifiers: l.required ? 1 : -1,
      })),
      variations: ordered.map((v, i) => ({
        type: 'ITEM_VARIATION',
        id: v.squareId ?? `#var-${v.id}`,
        ...version(v.squareVersion),
        itemVariationData: {
          itemId: itemRef,
          name: v.name,
          ordinal: i,
          pricingType: 'FIXED_PRICING',
          priceMoney: money(v.priceCents),
          ...(v.isDefault && item.sku ? { sku: item.sku } : {}),
        },
      })),
    },
  } as Obj;

  // Lists first so the item's modifierListInfo can reference their temp ids.
  const res = await squareClient().catalog.batchUpsert(
    { idempotencyKey: randomUUID(), batches: [{ objects: [...lists.map((l) => l.object), itemObject] }] },
    OPTS,
  );

  const idFor = new Map<string, string>();
  for (const m of res.idMappings ?? []) if (m.clientObjectId && m.objectId) idFor.set(m.clientObjectId, m.objectId);
  const real = (ref: string) => (ref.startsWith('#') ? idFor.get(ref) : ref);

  // Index every returned object (and nested ones) by id → version.
  const versions = new Map<string, number | null>();
  for (const o of res.objects ?? []) {
    if (o.id) versions.set(o.id, num(o.version));
    if (o.type === 'ITEM') for (const v of o.itemData?.variations ?? []) if (v.id) versions.set(v.id, num(v.version));
    if (o.type === 'MODIFIER_LIST')
      for (const m of o.modifierListData?.modifiers ?? []) if (m.id) versions.set(m.id, num(m.version));
  }

  const savedItemId = real(itemRef);
  if (!savedItemId) throw new Error('Square returned no id for the item');

  // Lists this item used to reference that it no longer does (e.g. its last
  // required modifier was removed): delete them unless another local item uses them.
  const previousListIds = [...new Set(modifiers.map((m) => m.squareModifierListId).filter((x): x is string => !!x))];
  const keptListIds = new Set(lists.map((l) => real(l.id)).filter((x): x is string => !!x));

  await db.transaction(async (tx) => {
    await tx
      .update(menuItems)
      .set({ squareId: savedItemId, squareVersion: versions.get(savedItemId) ?? null, syncStatus: 'synced', syncError: null, syncedAt: new Date() })
      .where(eq(menuItems.id, item.id));
    for (const v of ordered) {
      const sid = real(v.squareId ?? `#var-${v.id}`);
      if (sid) await tx.update(menuItemVariations).set({ squareId: sid, squareVersion: versions.get(sid) ?? null }).where(eq(menuItemVariations.id, v.id));
    }
    for (const l of lists) {
      const listId = real(l.id);
      if (!listId) continue;
      for (const m of l.mods) {
        const ref = m.squareId && m.squareModifierListId === l.id ? m.squareId : `#mod-${m.id}`;
        const sid = real(ref);
        await tx
          .update(menuModifiers)
          .set({
            squareId: sid ?? null,
            squareVersion: sid ? (versions.get(sid) ?? null) : null,
            squareModifierListId: listId,
            squareModifierListVersion: versions.get(listId) ?? null,
          })
          .where(eq(menuModifiers.id, m.id));
      }
    }
  });

  const dropped = previousListIds.filter((id) => !keptListIds.has(id));
  if (dropped.length) await deleteUnusedLists(dropped);
}

/** Delete modifier lists no local modifier references any more. */
export async function deleteUnusedLists(listIds: string[]): Promise<void> {
  const stillUsed = await db
    .selectDistinct({ id: menuModifiers.squareModifierListId })
    .from(menuModifiers)
    .where(inArray(menuModifiers.squareModifierListId, listIds));
  const used = new Set(stillUsed.map((r) => r.id));
  const orphans = listIds.filter((id) => !used.has(id));
  if (orphans.length) await deleteCatalogObjects(orphans);
}

/** Delete Square catalog objects by id (an ITEM delete also removes its variations). */
export async function deleteCatalogObjects(objectIds: string[]): Promise<void> {
  if (objectIds.length === 0) return;
  await assertPushAllowed();
  await squareClient().catalog.batchDelete({ objectIds }, OPTS);
}

// --- Pull -------------------------------------------------------------------------

export type PullResult = {
  categories: { created: number; updated: number; removed: number };
  items: { created: number; updated: number; removed: number; keptForHistory: number };
};

/**
 * Import the Square catalog into our menu (the "Pull from Square" button).
 * Square wins for every object it knows about; local items never pushed
 * (sync_status 'local') are left untouched.
 */
export async function pullCatalog(): Promise<PullResult> {
  const [store] = await db.select().from(stores).limit(1);
  if (!store) throw new Error('no store');

  const all: Obj[] = [];
  for await (const o of await squareClient().catalog.list({ types: 'CATEGORY,ITEM,MODIFIER_LIST' }, OPTS)) all.push(o);
  const sqCategories = all.filter((o): o is Square.CatalogObject.Category => o.type === 'CATEGORY' && !o.isDeleted);
  const sqItems = all.filter((o): o is Square.CatalogObject.Item => o.type === 'ITEM' && !o.isDeleted);
  const sqLists = new Map(
    all
      .filter((o): o is Square.CatalogObject.ModifierList => o.type === 'MODIFIER_LIST' && !o.isDeleted)
      .map((l) => [l.id!, l]),
  );

  const result: PullResult = {
    categories: { created: 0, updated: 0, removed: 0 },
    items: { created: 0, updated: 0, removed: 0, keptForHistory: 0 },
  };
  const now = new Date();

  await db.transaction(async (tx) => {
    // Categories, matched on square_id.
    const catIdBySquare = new Map<string, string>();
    const [maxOrder] = await tx
      .select({ n: max(menuCategories.sortOrder) })
      .from(menuCategories)
      .where(eq(menuCategories.storeId, store.id));
    let nextOrder = (maxOrder?.n ?? -1) + 1;
    for (const c of sqCategories) {
      const values = {
        name: c.categoryData?.name?.trim() || 'Untitled',
        squareId: c.id!,
        squareVersion: num(c.version),
        syncStatus: 'synced' as const,
        syncError: null,
        syncedAt: now,
      };
      const [existing] = await tx.select({ id: menuCategories.id }).from(menuCategories).where(eq(menuCategories.squareId, c.id!));
      if (existing) {
        await tx.update(menuCategories).set(values).where(eq(menuCategories.id, existing.id));
        catIdBySquare.set(c.id!, existing.id);
        result.categories.updated++;
      } else {
        const [row] = await tx.insert(menuCategories).values({ ...values, storeId: store.id, sortOrder: nextOrder++ }).returning({ id: menuCategories.id });
        catIdBySquare.set(c.id!, row!.id);
        result.categories.created++;
      }
    }

    // Items without a category in Square land in "Uncategorized".
    let uncategorized: string | null = null;
    const fallbackCategory = async (): Promise<string> => {
      if (uncategorized) return uncategorized;
      const [found] = await tx
        .select({ id: menuCategories.id })
        .from(menuCategories)
        .where(and(eq(menuCategories.storeId, store.id), eq(menuCategories.name, 'Uncategorized')));
      uncategorized =
        found?.id ??
        (await tx.insert(menuCategories).values({ storeId: store.id, name: 'Uncategorized', sortOrder: nextOrder++ }).returning({ id: menuCategories.id }))[0]!.id;
      return uncategorized;
    };

    for (const it of sqItems) {
      const data = it.itemData ?? {};
      const sqCatId = data.categories?.[0]?.id ?? data.reportingCategory?.id ?? data.categoryId ?? undefined;
      const categoryId = (sqCatId && catIdBySquare.get(sqCatId)) || (await fallbackCategory());
      const sqVariations = (data.variations ?? []).filter(
        (v): v is Square.CatalogObject.ItemVariation => v.type === 'ITEM_VARIATION' && !v.isDeleted,
      );
      const firstVar = sqVariations[0];
      const values = {
        categoryId,
        name: data.name?.trim() || 'Untitled',
        description: data.description ?? null,
        sku: firstVar?.itemVariationData?.sku ?? null,
        isAvailable: !data.isArchived,
        squareId: it.id!,
        squareVersion: num(it.version),
        syncStatus: 'synced' as const,
        syncError: null,
        syncedAt: now,
      };

      const [existing] = await tx.select({ id: menuItems.id }).from(menuItems).where(eq(menuItems.squareId, it.id!));
      let itemId: string;
      if (existing) {
        await tx.update(menuItems).set(values).where(eq(menuItems.id, existing.id));
        itemId = existing.id;
        result.items.updated++;
      } else {
        itemId = (await tx.insert(menuItems).values(values).returning({ id: menuItems.id }))[0]!.id;
        result.items.created++;
      }

      // Variations: Square is the truth for this item — upsert by square_id, drop the rest.
      const keepVar: string[] = [];
      for (const [i, v] of sqVariations.entries()) {
        const vd = v.itemVariationData ?? {};
        const vals = {
          itemId,
          name: vd.name?.trim() || 'Regular',
          priceCents: num(vd.priceMoney?.amount) ?? 0,
          isDefault: i === 0,
          squareId: v.id!,
          squareVersion: num(v.version),
        };
        const [ev] = await tx.select({ id: menuItemVariations.id }).from(menuItemVariations).where(eq(menuItemVariations.squareId, v.id!));
        if (ev) {
          await tx.update(menuItemVariations).set(vals).where(eq(menuItemVariations.id, ev.id));
          keepVar.push(ev.id);
        } else {
          keepVar.push((await tx.insert(menuItemVariations).values(vals).returning({ id: menuItemVariations.id }))[0]!.id);
        }
      }
      await tx
        .delete(menuItemVariations)
        .where(and(eq(menuItemVariations.itemId, itemId), keepVar.length ? notInArray(menuItemVariations.id, keepVar) : undefined));

      // Modifiers from every enabled list on the item; a list with a minimum
      // selection makes its modifiers "required".
      const keepMod: string[] = [];
      for (const info of data.modifierListInfo ?? []) {
        if (info.enabled === false || !info.modifierListId) continue;
        const list = sqLists.get(info.modifierListId);
        if (!list) continue;
        const required = (info.minSelectedModifiers ?? 0) > 0;
        for (const m of list.modifierListData?.modifiers ?? []) {
          if (m.type !== 'MODIFIER' || m.isDeleted || !m.id) continue;
          const vals = {
            itemId,
            name: m.modifierData?.name?.trim() || 'Modifier',
            priceCentsDelta: num(m.modifierData?.priceMoney?.amount) ?? 0,
            isRequired: required,
            squareId: m.id,
            squareVersion: num(m.version),
            squareModifierListId: list.id!,
            squareModifierListVersion: num(list.version),
          };
          // Shared lists: the same Square modifier can belong to several of our items.
          const [em] = await tx
            .select({ id: menuModifiers.id })
            .from(menuModifiers)
            .where(and(eq(menuModifiers.itemId, itemId), eq(menuModifiers.squareId, m.id)));
          if (em) {
            await tx.update(menuModifiers).set(vals).where(eq(menuModifiers.id, em.id));
            keepMod.push(em.id);
          } else {
            keepMod.push((await tx.insert(menuModifiers).values(vals).returning({ id: menuModifiers.id }))[0]!.id);
          }
        }
      }
      await tx
        .delete(menuModifiers)
        .where(and(eq(menuModifiers.itemId, itemId), keepMod.length ? notInArray(menuModifiers.id, keepMod) : undefined));
    }

    // Items we had pushed that no longer exist in Square were deleted there.
    const liveItemIds = sqItems.map((i) => i.id!);
    const goneItems = await tx
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(
        and(isNotNull(menuItems.squareId), liveItemIds.length ? notInArray(menuItems.squareId, liveItemIds) : undefined),
      );
    for (const g of goneItems) {
      const [used] = await tx.select({ n: count() }).from(orderItems).where(eq(orderItems.menuItemId, g.id));
      if ((used?.n ?? 0) > 0) {
        // Keep it for order history, but hidden and detached from Square.
        await tx
          .update(menuItems)
          .set({ isAvailable: false, squareId: null, squareVersion: null, syncStatus: 'local', syncError: null })
          .where(eq(menuItems.id, g.id));
        result.items.keptForHistory++;
      } else {
        await tx.delete(menuModifiers).where(eq(menuModifiers.itemId, g.id));
        await tx.delete(menuItemVariations).where(eq(menuItemVariations.itemId, g.id));
        await tx.delete(menuItems).where(eq(menuItems.id, g.id));
        result.items.removed++;
      }
    }

    // Same for categories, but only drop ones that ended up empty.
    const liveCatIds = sqCategories.map((c) => c.id!);
    const goneCats = await tx
      .select({ id: menuCategories.id })
      .from(menuCategories)
      .where(
        and(
          eq(menuCategories.storeId, store.id),
          isNotNull(menuCategories.squareId),
          liveCatIds.length ? notInArray(menuCategories.squareId, liveCatIds) : undefined,
        ),
      );
    for (const g of goneCats) {
      const [items] = await tx.select({ n: count() }).from(menuItems).where(eq(menuItems.categoryId, g.id));
      if ((items?.n ?? 0) === 0) {
        await tx.delete(menuCategories).where(eq(menuCategories.id, g.id));
        result.categories.removed++;
      } else {
        await tx
          .update(menuCategories)
          .set({ squareId: null, squareVersion: null, syncStatus: 'local', syncError: null })
          .where(eq(menuCategories.id, g.id));
      }
    }

    await tx.update(stores).set({ catalogPulledAt: now }).where(eq(stores.id, store.id));
  });

  logger.info({ result }, 'square catalog pulled');
  return result;
}
