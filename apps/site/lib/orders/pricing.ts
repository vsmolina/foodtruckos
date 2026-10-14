import 'server-only';
import { inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { menuItems, menuModifiers, menuVariations, type WebOrderLine } from '@/lib/db/schema';
import type { CartLine } from './cart';

export class CartError extends Error {}

export type PricedLine = WebOrderLine & {
  variationSquareId: string | null;
  modifierSquareIds: Array<string | null>;
};

/**
 * Re-price a cart from the database: every id must exist, belong together and
 * be orderable; modifier group limits are enforced. Throws CartError with a
 * message the customer can act on.
 */
export async function priceCart(lines: CartLine[]): Promise<{ lines: PricedLine[]; subtotalCents: number }> {
  const varIds = [...new Set(lines.map((l) => l.variationId))];
  const modIds = [...new Set(lines.flatMap((l) => l.modifierIds))];
  const vars = await db.select().from(menuVariations).where(inArray(menuVariations.id, varIds));
  const items = vars.length
    ? await db.select().from(menuItems).where(inArray(menuItems.id, [...new Set(vars.map((v) => v.itemId))]))
    : [];
  const mods = modIds.length ? await db.select().from(menuModifiers).where(inArray(menuModifiers.id, modIds)) : [];

  const priced: PricedLine[] = [];
  for (const l of lines) {
    const v = vars.find((x) => x.id === l.variationId);
    const item = v && items.find((i) => i.id === v.itemId);
    if (!v || !item || item.hidden) throw new CartError('Something in your bag is no longer on the menu. Remove it and try again.');
    if (item.soldOut || item.squareSoldOut) throw new CartError(`Sorry — ${item.name} just sold out. Remove it to continue.`);

    const chosen = [...new Set(l.modifierIds)].map((id) => {
      const m = mods.find((x) => x.id === id);
      if (!m || m.itemId !== item.id) throw new CartError(`An option on ${item.name} changed. Remove it and add it again.`);
      return m;
    });
    // Group rules: max picks and required groups.
    const allGroups = await groupsFor(item.id);
    for (const [group, rule] of allGroups) {
      const picked = chosen.filter((m) => m.groupName === group).length;
      if (rule.max != null && picked > rule.max) throw new CartError(`${item.name}: pick at most ${rule.max} in “${group}”.`);
      if (rule.required && picked === 0) throw new CartError(`${item.name}: choose an option in “${group}”.`);
    }

    const unitCents = v.priceCents + chosen.reduce((s, m) => s + m.priceCents, 0);
    priced.push({
      variationId: v.id,
      itemName: item.name,
      variationName: v.name,
      qty: l.qty,
      unitCents,
      modifiers: chosen.map((m) => ({ id: m.id, name: m.name, priceCents: m.priceCents })),
      ...(l.note ? { note: l.note } : {}),
      variationSquareId: v.squareId,
      modifierSquareIds: chosen.map((m) => m.squareId),
    });
  }
  return { lines: priced, subtotalCents: priced.reduce((s, l) => s + l.unitCents * l.qty, 0) };

  async function groupsFor(itemId: string): Promise<Map<string, { max: number | null; required: boolean }>> {
    const rows = await db
      .select({ groupName: menuModifiers.groupName, groupMax: menuModifiers.groupMax, groupRequired: menuModifiers.groupRequired })
      .from(menuModifiers)
      .where(inArray(menuModifiers.itemId, [itemId]));
    return new Map(rows.map((r) => [r.groupName, { max: r.groupMax, required: r.groupRequired }]));
  }
}

/** Store the snapshot without the Square ids. */
export function snapshot(lines: PricedLine[]): WebOrderLine[] {
  return lines.map((l) => ({
    variationId: l.variationId,
    itemName: l.itemName,
    variationName: l.variationName,
    qty: l.qty,
    unitCents: l.unitCents,
    modifiers: l.modifiers,
    ...(l.note ? { note: l.note } : {}),
  }));
}

/** True when every line can be sent to Square by catalog id. */
export function squareReady(lines: PricedLine[]): boolean {
  return lines.every((l) => l.variationSquareId && l.modifierSquareIds.every(Boolean));
}
