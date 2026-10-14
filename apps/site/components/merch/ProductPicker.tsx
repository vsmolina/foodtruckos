'use client';

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { Button, buttonClass } from '@/components/ui/Button';
import { cx } from '@/lib/cx';
import { money } from '@/lib/format';
import { addToCart, MAX_QTY } from './cart-store';

export type PickerVariant = {
  id: string;
  size: string | null;
  color: string | null;
  priceCents: number;
  inStock: boolean;
  lowStock: number | null;
};

// Size / colour as big radio chips (44px+). A chip is disabled and struck
// through when no in-stock variant matches it with the other choice.

export function ProductPicker({
  slug,
  name,
  variants,
}: {
  slug: string;
  name: string;
  variants: PickerVariant[];
}) {
  const sizes = useMemo(
    () => [...new Set(variants.map((v) => v.size).filter((s): s is string => !!s))],
    [variants],
  );
  const colors = useMemo(
    () => [...new Set(variants.map((v) => v.color).filter((c): c is string => !!c))],
    [variants],
  );
  const firstInStock = variants.find((v) => v.inStock) ?? variants[0];
  const [size, setSize] = useState<string | null>(firstInStock?.size ?? null);
  const [color, setColor] = useState<string | null>(firstInStock?.color ?? null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const match = (s: string | null, c: string | null) =>
    variants.find(
      (v) => (sizes.length ? v.size === s : true) && (colors.length ? v.color === c : true),
    );
  const selected = match(size, color);
  const soldOut = !selected?.inStock;
  const maxQty = selected?.lowStock != null ? Math.min(MAX_QTY, selected.lowStock) : MAX_QTY;

  const add = () => {
    if (!selected || soldOut) return;
    addToCart({
      variantId: selected.id,
      qty: Math.min(qty, maxQty),
      slug,
      name,
      label: [selected.size, selected.color].filter(Boolean).join(' / '),
      unitCents: selected.priceCents,
    });
    setAdded(true);
  };

  return (
    <div className="flex flex-col gap-5">
      {sizes.length > 1 ? (
        <ChipGroup
          legend="Size"
          name="size"
          options={sizes.map((s) => ({ value: s, available: !!match(s, color)?.inStock }))}
          value={size}
          onChange={(v) => {
            setSize(v);
            setAdded(false);
          }}
        />
      ) : null}
      {colors.length > 1 ? (
        <ChipGroup
          legend="Color"
          name="color"
          options={colors.map((c) => ({ value: c, available: !!match(size, c)?.inStock }))}
          value={color}
          onChange={(v) => {
            setColor(v);
            setAdded(false);
          }}
        />
      ) : null}

      <div className="flex items-center gap-4">
        <span className="font-display text-h2">{selected ? money(selected.priceCents) : '—'}</span>
        {selected?.lowStock != null && selected.lowStock > 0 && selected.lowStock <= 3 ? (
          <span className="font-hand text-lg text-marigold">
            ¡Quedan {selected.lowStock}! Only {selected.lowStock} left
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex items-center rounded-sm border-[length:var(--line-thin)] border-outline bg-paper text-paper-ink shadow-hard-sm"
          role="group"
          aria-label="Quantity"
        >
          <button
            type="button"
            className="grid h-12 w-12 place-items-center text-xl font-bold disabled:opacity-40"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            aria-label="One fewer"
          >
            −
          </button>
          <span className="w-8 text-center text-lg font-bold tabular-nums" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            className="grid h-12 w-12 place-items-center text-xl font-bold disabled:opacity-40"
            onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
            disabled={qty >= maxQty}
            aria-label="One more"
          >
            +
          </button>
        </div>
        <Button type="button" size="lg" onClick={add} disabled={soldOut}>
          {soldOut ? 'Sold out' : 'Add to cart'}
        </Button>
      </div>

      <p role="status" className="min-h-6">
        {added ? (
          <span className="flex flex-wrap items-center gap-3 font-bold">
            Added to your cart.
            <Link href="/merch/cart" className={buttonClass('marigold', 'sm')}>
              Go to cart →
            </Link>
          </span>
        ) : null}
      </p>
    </div>
  );
}

function ChipGroup({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: Array<{ value: string; available: boolean }>;
  value: string | null;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold">
        {legend}: <span className="font-normal">{value ?? 'choose one'}</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              htmlFor={`${id}-${o.value}`}
              className={cx(
                'press shadow-hard-sm relative inline-flex min-h-12 min-w-12 cursor-pointer items-center justify-center rounded-sm border-[length:var(--line-thin)] border-outline px-3 font-display uppercase has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]',
                checked ? 'bg-marigold text-on-marigold' : 'bg-surface text-ink',
                !o.available && 'text-ink-muted line-through decoration-2',
              )}
            >
              <input
                id={`${id}-${o.value}`}
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="sr-only"
                aria-describedby={o.available ? undefined : `${id}-${o.value}-out`}
              />
              {o.value}
              {o.available ? null : (
                <span id={`${id}-${o.value}-out`} className="sr-only">
                  (sold out)
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
