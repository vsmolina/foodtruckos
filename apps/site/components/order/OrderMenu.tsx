'use client';

import Image from 'next/image';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sticker } from '@/components/ui/Sticker';
import { cx } from '@/lib/cx';
import { price } from '@/lib/format';
import type { MenuCategory, MenuItem } from '@/lib/menu';
import { CartBar } from './CartBar';
import { useCart } from './CartProvider';
import { ItemSheet } from './ItemSheet';

// The order menu: category chips, then one card per item. Tapping an item
// opens the customization sheet (or adds it straight away when there is
// nothing to choose). `readOnly` shows the menu while ordering is off.

const TILT = ['tilt-c', 'tilt-b', 'tilt-a', 'tilt-d'] as const;

export function OrderMenu({ menu, readOnly = false }: { menu: MenuCategory[]; readOnly?: boolean }) {
  const cart = useCart();
  const [open, setOpen] = useState<MenuItem | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  function choose(item: MenuItem) {
    if (readOnly || item.soldOut) return;
    const simple = item.variations.length === 1 && item.modifierGroups.length === 0;
    if (simple) {
      cart.add({ variationId: item.variations[0]!.id, modifierIds: [], qty: 1 });
      flash(item.name);
    } else {
      setOpen(item);
    }
  }

  function flash(name: string) {
    setAdded(`${name} added to your bag`);
    window.setTimeout(() => setAdded(null), 2200);
  }

  return (
    <>
      <nav aria-label="Menu sections" className="sticky top-0 z-20 -mx-4 border-b-[length:var(--line-thin)] border-outline bg-bg/95 px-4 py-2 backdrop-blur-sm">
        <ul className="flex gap-2 overflow-x-auto">
          {menu.map((c) => (
            <li key={c.id} className="shrink-0">
              <a href={`#cat-${c.id}`} className="inline-flex min-h-11 items-center rounded-sm border-[length:var(--line-thin)] border-outline bg-surface px-3 text-sm font-bold no-underline">
                {c.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex flex-col gap-10 pt-6">
        {menu.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} aria-labelledby={`h-${c.id}`} className="scroll-mt-20">
            <div className="flex items-baseline gap-3">
              <h2 id={`h-${c.id}`} className="font-display text-h2 uppercase">
                {c.name}
              </h2>
              {c.labelEs ? <span className="font-hand text-lg text-marigold">{c.labelEs}</span> : null}
            </div>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {c.items.map((item, i) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => choose(item)}
                    disabled={item.soldOut}
                    aria-disabled={readOnly || undefined}
                    aria-label={
                      item.soldOut
                        ? `${item.name}, sold out`
                        : readOnly
                          ? `${item.name}, ${price(item.fromCents)}`
                          : `Add ${item.name}, ${price(item.fromCents)}`
                    }
                    className={cx(
                      'panel relative flex w-full gap-3 p-3 text-left',
                      !readOnly && !item.soldOut && 'press',
                      item.soldOut && 'cursor-not-allowed',
                      readOnly && 'cursor-default',
                    )}
                  >
                    {item.photoUrl ? (
                      <span className="relative h-24 w-24 shrink-0 overflow-hidden rounded-sm border-[length:var(--line-thin)] border-outline">
                        <Image src={item.photoUrl} alt="" fill sizes="96px" className={cx('object-cover', item.soldOut && 'grayscale')} />
                      </span>
                    ) : null}
                    <span className={cx('flex min-w-0 flex-1 flex-col gap-1', item.soldOut && 'opacity-60')}>
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-display text-lg uppercase leading-tight">{item.name}</span>
                        <span className="shrink-0 font-display text-lg text-marigold">
                          {item.variations.length > 1 ? <span className="text-sm text-ink-muted">from </span> : null}
                          {price(item.fromCents)}
                        </span>
                      </span>
                      {item.taglineEs ? <span className="font-hand text-base text-marigold">{item.taglineEs}</span> : null}
                      {item.description ? <span className="text-sm text-ink-muted">{item.description}</span> : null}
                      {!readOnly && !item.soldOut ? (
                        <span className="mt-1 self-start rounded-sm border-[length:var(--line-thin)] border-outline bg-chile px-2.5 py-1 font-display text-sm uppercase text-on-chile">
                          + Add
                        </span>
                      ) : null}
                    </span>
                    {item.soldOut ? (
                      <Sticker tone="chile" tilt="e" className="absolute -right-2 -top-3">
                        Sold out · Agotado
                      </Sticker>
                    ) : item.isNew ? (
                      <Sticker tone="rosa" tilt={TILT[i % 4] === 'tilt-d' ? 'd' : 'b'} size="sm" className="absolute -right-2 -top-3">
                        ¡Nuevo!
                      </Sticker>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {added ?? ''}
      </p>
      {added
        ? createPortal(
            <div aria-hidden className="pop-in fixed inset-x-0 bottom-24 z-40 mx-auto w-fit rounded-sm border-[length:var(--line-thin)] border-outline bg-agave px-4 py-2 font-bold text-on-agave shadow-hard-sm">
              ✓ {added}
            </div>,
            document.body,
          )
        : null}

      <ItemSheet
        item={open}
        onClose={() => setOpen(null)}
        onAdd={(line) => {
          cart.add(line);
          if (open) flash(open.name);
        }}
      />
      {!readOnly ? <CartBar /> : null}
    </>
  );
}
