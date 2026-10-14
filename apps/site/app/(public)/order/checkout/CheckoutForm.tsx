'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useCart } from '@/components/order/CartProvider';
import { SquareCard, type SquareCardHandle } from '@/components/order/SquareCard';
import { Button, buttonClass, Spinner } from '@/components/ui/Button';
import { Checkbox, FormNotice, TextField } from '@/components/ui/Field';
import { cx } from '@/lib/cx';
import { money } from '@/lib/format';
import { TIP_OPTIONS, type TipPercent } from '@/lib/orders/cart';
import { placeOrder, quoteCart, type Quote } from '../actions';

export function CheckoutForm({
  square,
  consentText,
}: {
  square: { appId: string; locationId: string; env: 'sandbox' | 'production' };
  consentText: string;
}) {
  const cart = useCart();
  const router = useRouter();
  const card = useRef<SquareCardHandle>(null);
  const [tip, setTip] = useState<TipPercent>(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'name' | 'phone', string>>>({});
  const [placing, startPlacing] = useTransition();
  const [quoting, startQuoting] = useTransition();
  const cartKey = cart.entries.map((e) => `${e.key}x${e.qty}`).join(',');

  // Server-priced summary; re-run when the bag or the tip changes.
  useEffect(() => {
    if (!cart.ready || cart.count === 0) return;
    startQuoting(async () => setQuote(await quoteCart(cart.lines(), tip)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ready, cartKey, tip]);

  if (!cart.ready) {
    return (
      <p className="mt-8 flex items-center gap-2">
        <Spinner /> Loading your bag…
      </p>
    );
  }
  if (cart.count === 0) {
    return (
      <div className="panel mt-8 flex flex-col items-start gap-4 p-6">
        <p className="text-lg font-bold">Your bag is empty.</p>
        <Link href="/order" className={buttonClass('primary')}>
          Back to the menu
        </Link>
      </div>
    );
  }

  // onSubmit (not a form action) so a failed attempt keeps what was typed.
  function submit(form: FormData) {
    setError(null);
    setFieldErrors({});
    if (!quote?.ok) return;
    startPlacing(async () => {
      let sourceId: string | undefined;
      if (quote.paymentMode === 'square') {
        try {
          sourceId = await card.current?.tokenize();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Check your card details.');
          return;
        }
      }
      const res = await placeOrder({
        lines: cart.lines(),
        name: String(form.get('name') ?? ''),
        phone: String(form.get('phone') ?? ''),
        smsOptIn: form.get('sms') === 'yes',
        tipPercent: tip,
        ...(sourceId ? { sourceId } : {}),
      });
      if (res.ok) {
        cart.clear();
        router.push(`/order/${res.token}`);
      } else {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget));
      }}
      className="mt-8 flex flex-col gap-6"
      noValidate
    >
      {error ? <FormNotice tone="error">{error}</FormNotice> : null}

      <section className="paper flex flex-col gap-3 p-4" aria-labelledby="summary-h">
        <div className="flex items-center justify-between">
          <h2 id="summary-h" className="font-display text-lg uppercase">
            Your order
          </h2>
          <Link href="/order" className="text-sm font-bold underline">
            Edit
          </Link>
        </div>
        {quote?.ok ? (
          <>
            <ul className="flex flex-col gap-2">
              {quote.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>
                    <span className="font-bold">
                      {l.qty}× {l.name}
                    </span>
                    {l.detail ? <span className="block text-sm text-[#5e5248]">{l.detail}</span> : null}
                  </span>
                  <span className="tabular-nums">{money(l.lineCents)}</span>
                </li>
              ))}
            </ul>
            <dl className={cx('grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t-2 border-[#14110e] pt-3 tabular-nums', quoting && 'opacity-60')}>
              <dt>Subtotal</dt>
              <dd className="text-right">{money(quote.subtotalCents)}</dd>
              <dt>Tax</dt>
              <dd className="text-right">{money(quote.taxCents)}</dd>
              {quote.tipCents ? (
                <>
                  <dt>Tip</dt>
                  <dd className="text-right">{money(quote.tipCents)}</dd>
                </>
              ) : null}
              <dt className="text-lg font-bold">Total</dt>
              <dd className="text-right text-lg font-bold">{money(quote.totalCents)}</dd>
            </dl>
            <p className="text-sm">
              Pickup at the window, ready in about <strong>{quote.waitMinutes} min</strong>.
            </p>
          </>
        ) : quote && !quote.ok ? (
          <p role="alert" className="font-bold text-[#b3261e]">
            ✕ {quote.error}
          </p>
        ) : (
          <p className="flex items-center gap-2">
            <Spinner /> Adding it up…
          </p>
        )}
      </section>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-display text-lg uppercase">Who’s picking up?</legend>
        <TextField name="name" label="Name for the order" autoComplete="given-name" required maxLength={40} error={fieldErrors.name} hint="We’ll call it out at the window." />
        <TextField
          name="phone"
          type="tel"
          inputMode="tel"
          label="Mobile number"
          autoComplete="tel"
          required
          error={fieldErrors.phone}
          hint="Only for this order — so we can reach you if something’s off."
        />
        <Checkbox name="sms" label={consentText} />
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-display text-lg uppercase">Tip the crew?</legend>
        <div className="grid grid-cols-4 gap-2">
          {TIP_OPTIONS.map((t) => (
            <label
              key={t}
              className={cx(
                'press shadow-hard-sm flex min-h-12 cursor-pointer items-center justify-center rounded-sm border-[length:var(--line-thin)] border-outline font-bold',
                tip === t ? 'bg-marigold text-on-marigold' : 'bg-surface text-ink',
              )}
            >
              <input type="radio" name="tip" value={t} checked={tip === t} onChange={() => setTip(t)} className="sr-only" />
              {t === 0 ? 'No tip' : `${t}%`}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-display text-lg uppercase">Pay</legend>
        {quote?.ok && quote.paymentMode === 'square' ? (
          <div className="paper p-3">
            <SquareCard ref={card} appId={square.appId} locationId={square.locationId} env={square.env} />
            <p className="text-xs text-[#5e5248]">Payments are processed securely by Square. We never see your card number.</p>
          </div>
        ) : quote?.ok ? (
          <p className="rounded-sm border-[length:var(--line-thin)] border-dashed border-ink-muted p-3 text-sm">
            <strong>Test mode:</strong> payments aren’t connected on this server, so no card is charged.
          </p>
        ) : null}
      </fieldset>

      <Button type="submit" size="lg" loading={placing} disabled={!quote?.ok || quoting}>
        {quote?.ok ? `Place order · ${money(quote.totalCents)}` : 'Place order'}
      </Button>
      <p className="text-center text-sm text-ink-muted">
        By ordering you agree to our{' '}
        <Link href="/terms" className="underline">
          terms
        </Link>
        . Pickup only.
      </p>
    </form>
  );
}
