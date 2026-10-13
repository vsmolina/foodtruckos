'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CartLine } from '@/lib/orders/cart';
import type { MenuCategory, MenuItem } from '@/lib/menu';

// The food cart lives in the browser (localStorage 'bb:cart') so a dropped
// connection or a reload doesn't lose it. Prices shown here are for display
// only — the server re-prices everything at checkout.

const KEY = 'bb:cart';

export type CartEntry = CartLine & { key: string };
export type ResolvedEntry = CartEntry & {
  item: MenuItem;
  variationName: string;
  modifierNames: string[];
  unitCents: number;
};

type CartCtx = {
  entries: ResolvedEntry[];
  count: number;
  subtotalCents: number;
  ready: boolean;
  add: (line: CartLine) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  lines: () => CartLine[];
};

const Ctx = createContext<CartCtx | null>(null);

function read(): CartEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CartEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: CartEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* private mode etc. — the cart still works for this page view */
  }
}

/** Same item + size + options + note = same line (bump the quantity). */
function keyOf(l: CartLine): string {
  return [l.variationId, [...l.modifierIds].sort().join('.'), l.note ?? ''].join('|');
}

export function CartProvider({ menu, children }: { menu: MenuCategory[]; children: React.ReactNode }) {
  const [raw, setRaw] = useState<CartEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Hydrate from storage after mount (storage is client-only).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRaw(read());
    setReady(true);
  }, []);

  const update = useCallback((fn: (prev: CartEntry[]) => CartEntry[]) => {
    setRaw((prev) => {
      const next = fn(prev);
      write(next);
      return next;
    });
  }, []);

  const entries = useMemo(() => {
    const items = menu.flatMap((c) => c.items);
    const out: ResolvedEntry[] = [];
    for (const e of raw) {
      const item = items.find((i) => i.variations.some((v) => v.id === e.variationId));
      const variation = item?.variations.find((v) => v.id === e.variationId);
      if (!item || !variation) continue; // no longer on the menu
      const options = item.modifierGroups.flatMap((g) => g.options);
      const mods = e.modifierIds.map((id) => options.find((o) => o.id === id)).filter((o) => o !== undefined);
      out.push({
        ...e,
        item,
        variationName: variation.name,
        modifierNames: mods.map((m) => m.name),
        unitCents: variation.priceCents + mods.reduce((s, m) => s + m.priceCents, 0),
      });
    }
    return out;
  }, [raw, menu]);

  const value = useMemo<CartCtx>(
    () => ({
      entries,
      ready,
      count: entries.reduce((s, e) => s + e.qty, 0),
      subtotalCents: entries.reduce((s, e) => s + e.unitCents * e.qty, 0),
      add: (line) =>
        update((prev) => {
          const key = keyOf(line);
          const found = prev.find((p) => p.key === key);
          if (found) return prev.map((p) => (p.key === key ? { ...p, qty: Math.min(20, p.qty + line.qty) } : p));
          return [...prev, { ...line, key }];
        }),
      setQty: (key, qty) => update((prev) => (qty <= 0 ? prev.filter((p) => p.key !== key) : prev.map((p) => (p.key === key ? { ...p, qty: Math.min(20, qty) } : p)))),
      remove: (key) => update((prev) => prev.filter((p) => p.key !== key)),
      clear: () => update(() => []),
      lines: () => entries.map(({ variationId, modifierIds, qty, note }) => ({ variationId, modifierIds, qty, ...(note ? { note } : {}) })),
    }),
    [entries, ready, update],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart outside CartProvider');
  return c;
}
