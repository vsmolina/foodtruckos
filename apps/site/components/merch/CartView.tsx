'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { createMerchCheckout, quoteMerchCart, type QuotedLine } from '@/app/(public)/merch/actions';
import { Button, LinkButton } from '@/components/ui/Button';
import { FormNotice } from '@/components/ui/Field';
import { cx } from '@/lib/cx';
import { money } from '@/lib/format';
import { MAX_QTY, setQty, useMerchCart } from './cart-store';

export function CartView({ shippingCents }: { shippingCents: number }) {
  const lines = useMerchCart();
  const [quoted, setQuoted] = useState<QuotedLine[] | null>(null);
  const [delivery, setDelivery] = useState<'ship' | 'pickup'>('ship');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const key = lines.map((l) => `${l.variantId}:${l.qty}`).join(',');

  // Refresh prices/stock from the server whenever the cart changes.
  useEffect(() => {
    if (!key) return;
    let live = true;
    quoteMerchCart(lines.map((l) => ({ variantId: l.variantId, qty: l.qty }))).then((r) => {
      if (!live) return;
      if ('error' in r) setError(r.error);
      else {
        setQuoted(r);
        setError(null);
      }
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (lines.length === 0) {
    return (
      <div className="paper tilt-c mt-8 flex flex-col items-start gap-4 p-6">
        <p className="font-display text-h3 uppercase">Your cart is empty</p>
        <p>¡Ándale! Grab a tee or some stickers.</p>
        <LinkButton href="/merch">Shop merch</LinkButton>
      </div>
    );
  }

  const rows = lines.map((l) => {
    const q = quoted?.find((x) => x.variantId === l.variantId);
    return {
      ...l,
      unitCents: q?.unitCents ?? l.unitCents,
      problem: q?.problem ?? null,
      available: q?.available ?? null,
      name: q?.productName ?? l.name,
    };
  });
  const subtotal = rows.reduce((n, r) => n + r.unitCents * r.qty, 0);
  const ship = delivery === 'ship' ? shippingCents : 0;
  const blocked = rows.some((r) => r.problem) || !quoted;

  const checkout = () =>
    start(async () => {
      setError(null);
      const res = await createMerchCheckout({
        lines: lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
        delivery,
      });
      if ('error' in res) setError(res.error);
      else window.location.assign(res.url);
    });

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <ul className="flex flex-col gap-4">
        {rows.map((r) => (
          <li
            key={r.variantId}
            className={cx(
              'panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center',
              r.problem && 'border-danger-fill',
            )}
          >
            <div className="min-w-0 flex-1">
              <Link
                href={`/merch/${r.slug}`}
                className="font-display text-lg uppercase no-underline hover:underline"
              >
                {r.name}
              </Link>
              {r.label ? <p className="text-sm text-ink-muted">{r.label}</p> : null}
              <p className="text-sm">{money(r.unitCents)} each</p>
              {r.problem ? (
                <p className="mt-1 text-sm font-bold text-danger" role="alert">
                  ✕ {r.problem}
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-4">
              <div
                className="flex items-center rounded-sm border-[length:var(--line-thin)] border-outline bg-paper text-paper-ink"
                role="group"
                aria-label={`Quantity of ${r.name}`}
              >
                <button
                  type="button"
                  className="grid h-11 w-11 place-items-center text-xl font-bold"
                  onClick={() => setQty(r.variantId, r.qty - 1)}
                  aria-label={r.qty === 1 ? `Remove ${r.name}` : 'One fewer'}
                >
                  −
                </button>
                <span className="w-7 text-center font-bold tabular-nums">{r.qty}</span>
                <button
                  type="button"
                  className="grid h-11 w-11 place-items-center text-xl font-bold disabled:opacity-40"
                  onClick={() => setQty(r.variantId, r.qty + 1)}
                  disabled={r.qty >= Math.min(MAX_QTY, r.available ?? MAX_QTY)}
                  aria-label="One more"
                >
                  +
                </button>
              </div>
              <span className="w-20 text-right font-bold tabular-nums">
                {money(r.unitCents * r.qty)}
              </span>
              <button
                type="button"
                onClick={() => setQty(r.variantId, 0)}
                className="min-h-11 text-sm font-bold underline"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="paper flex h-fit flex-col gap-4 p-5 lg:sticky lg:top-6">
        <fieldset>
          <legend className="mb-2 font-display uppercase">How do you want it?</legend>
          <div className="flex flex-col gap-2">
            {(
              [
                ['ship', 'Ship it', `Flat ${money(shippingCents)} anywhere in the US`],
                ['pickup', 'Pick up at the truck', 'Free — show your name at the window'],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={cx(
                  'flex min-h-14 cursor-pointer items-center gap-3 rounded-sm border-[length:var(--line-thin)] border-outline p-3 has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-[var(--focus)]',
                  delivery === value ? 'bg-marigold text-on-marigold' : 'bg-paper',
                )}
              >
                <input
                  type="radio"
                  name="delivery"
                  value={value}
                  checked={delivery === value}
                  onChange={() => setDelivery(value)}
                  className="h-6 w-6 shrink-0 appearance-none rounded-full border-2 border-outline bg-paper checked:bg-outline checked:shadow-[inset_0_0_0_4px_var(--paper)]"
                />
                <span>
                  <span className="block font-bold">{label}</span>
                  <span className="block text-sm">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-base">
          <dt>Subtotal</dt>
          <dd className="text-right tabular-nums">{money(subtotal)}</dd>
          <dt>Shipping</dt>
          <dd className="text-right tabular-nums">{ship ? money(ship) : 'Free'}</dd>
          <dt>Sales tax</dt>
          <dd className="text-right text-sm">at checkout</dd>
          <dt className="mt-2 border-t-2 border-outline pt-2 font-display uppercase">
            Total before tax
          </dt>
          <dd className="mt-2 border-t-2 border-outline pt-2 text-right font-display tabular-nums">
            {money(subtotal + ship)}
          </dd>
        </dl>
        {error ? <FormNotice tone="error">{error}</FormNotice> : null}
        <Button type="button" size="lg" onClick={checkout} loading={pending} disabled={blocked}>
          Checkout
        </Button>
        <p className="text-xs">Secure payment by Stripe. You’ll get an email receipt.</p>
      </div>
    </div>
  );
}
