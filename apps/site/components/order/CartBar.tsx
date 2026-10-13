'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buttonClass } from '@/components/ui/Button';
import { money } from '@/lib/format';
import { useCart } from './CartProvider';

// Sticky bag bar: count + total + Checkout, one thumb away. Tapping the count
// opens the bag drawer to change quantities.

export function CartBar() {
  const cart = useCart();
  const [open, setOpen] = useState(false);
  if (!cart.ready || cart.count === 0) return null;
  // Portalled to <body>: <main> is its own stacking context (z-10), which
  // would put a fixed bar underneath the footer.
  return createPortal(
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t-[length:var(--line)] border-outline bg-bg pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className="press shadow-hard-sm flex min-h-12 items-center gap-2 rounded-sm border-[length:var(--line-thin)] border-outline bg-surface px-3 font-bold"
          >
            <span className="grid h-7 min-w-7 place-items-center rounded-full bg-marigold px-1 text-sm text-on-marigold">{cart.count}</span>
            Bag · {money(cart.subtotalCents)}
          </button>
          <Link href="/order/checkout" className={buttonClass('primary', 'md', 'flex-1')}>
            Checkout →
          </Link>
        </div>
      </div>
      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </>,
    document.body,
  );
}

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cart = useCart();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    if (open && cart.count === 0) onClose();
  }, [open, cart.count, onClose]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="bag-title"
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-md bg-bg p-0 text-ink backdrop:bg-black/65"
    >
      <div className="flex h-full flex-col border-l-[length:var(--line)] border-outline">
        <div className="flex h-16 items-center justify-between border-b-[length:var(--line)] border-outline px-4">
          <h2 id="bag-title" className="font-display text-h3 uppercase">
            Your bag
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bag"
            className="press shadow-hard-sm grid h-11 w-11 place-items-center rounded-sm border-[length:var(--line-thin)] border-outline bg-paper text-paper-ink"
          >
            <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto px-4">
          {cart.entries.map((e) => (
            <li key={e.key} className="flex gap-3 border-b-2 border-surface-2 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{e.item.name}</p>
                <p className="text-sm text-ink-muted">
                  {[e.variationName !== 'Regular' ? e.variationName : null, ...e.modifierNames].filter(Boolean).join(' · ')}
                </p>
                {e.note ? <p className="text-sm italic text-ink-muted">“{e.note}”</p> : null}
                <p className="mt-1 font-bold tabular-nums">{money(e.unitCents * e.qty)}</p>
              </div>
              <div className="flex h-12 items-center self-center rounded-sm border-[length:var(--line-thin)] border-outline bg-surface" role="group" aria-label={`Quantity of ${e.item.name}`}>
                <button type="button" className="h-full w-11 text-xl font-bold" onClick={() => cart.setQty(e.key, e.qty - 1)} aria-label={e.qty === 1 ? `Remove ${e.item.name}` : 'One less'}>
                  {e.qty === 1 ? '×' : '−'}
                </button>
                <span className="w-7 text-center font-bold tabular-nums">{e.qty}</span>
                <button type="button" className="h-full w-11 text-xl font-bold" onClick={() => cart.setQty(e.key, e.qty + 1)} aria-label="One more">
                  +
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t-[length:var(--line)] border-outline p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="mb-3 flex justify-between font-bold">
            <span>Subtotal</span>
            <span className="tabular-nums">{money(cart.subtotalCents)}</span>
          </p>
          <Link href="/order/checkout" onClick={onClose} className={buttonClass('primary', 'lg', 'w-full')}>
            Checkout →
          </Link>
        </div>
      </div>
    </dialog>
  );
}
