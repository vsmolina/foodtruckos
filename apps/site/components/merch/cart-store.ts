'use client';

import { useSyncExternalStore } from 'react';

// Merch cart: per-browser convenience only (localStorage), never trusted —
// the server re-prices and re-checks stock at checkout.

export type CartLine = {
  variantId: string;
  qty: number;
  slug: string;
  name: string;
  label: string;
  unitCents: number;
};

const KEY = 'bb:merch-cart';
const EVENT = 'bb:merch-cart';
const EMPTY: CartLine[] = [];
let cache: { raw: string | null; lines: CartLine[] } = { raw: null, lines: EMPTY };

function read(): CartLine[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cache.raw) return cache.lines;
  let lines: CartLine[] = EMPTY;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      lines = parsed.filter(
        (l): l is CartLine =>
          l &&
          typeof l.variantId === 'string' &&
          Number.isInteger(l.qty) &&
          l.qty > 0 &&
          typeof l.name === 'string',
      );
    }
  } catch {
    lines = EMPTY;
  }
  cache = { raw, lines };
  return lines;
}

function write(lines: CartLine[]): void {
  try {
    if (lines.length) localStorage.setItem(KEY, JSON.stringify(lines));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: cart lives for this page only */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export function useMerchCart(): CartLine[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export const MAX_QTY = 10;

export function addToCart(line: CartLine): void {
  const lines = [...read()];
  const i = lines.findIndex((l) => l.variantId === line.variantId);
  if (i >= 0) lines[i] = { ...lines[i]!, qty: Math.min(MAX_QTY, lines[i]!.qty + line.qty) };
  else lines.push({ ...line, qty: Math.min(MAX_QTY, line.qty) });
  write(lines);
}

export function setQty(variantId: string, qty: number): void {
  write(
    read().flatMap((l) =>
      l.variantId === variantId ? (qty > 0 ? [{ ...l, qty: Math.min(MAX_QTY, qty) }] : []) : [l],
    ),
  );
}

export function clearCart(): void {
  write([]);
}
