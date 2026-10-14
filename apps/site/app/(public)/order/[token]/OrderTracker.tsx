'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Star } from '@/components/ui/Doodles';
import { Sticker } from '@/components/ui/Sticker';
import { cx } from '@/lib/cx';
import { clockTime, money } from '@/lib/format';
import type { PublicOrder } from '@/lib/orders/public';

// Live order status. Polls every 8 s while the order is in the kitchen (and
// the tab is visible); every step is a word + icon + colour, announced via
// aria-live so screen-reader users hear "Ready".

const STEPS = [
  { key: 'received', label: 'Received', es: 'Recibido' },
  { key: 'preparing', label: 'Preparing', es: 'En la plancha' },
  { key: 'ready', label: 'Ready', es: '¡Listo!' },
] as const;

const LIVE = new Set(['received', 'preparing', 'ready', 'pending_payment']);

export function OrderTracker({
  token,
  initial,
  location,
}: {
  token: string;
  initial: PublicOrder;
  location: { name: string; address: string };
}) {
  const [order, setOrder] = useState(initial);

  useEffect(() => {
    if (!LIVE.has(order.status)) return;
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(`/api/orders/${token}`, { cache: 'no-store' });
        if (res.ok && !stopped) setOrder((await res.json()) as PublicOrder);
      } catch {
        /* weak signal — try again next tick */
      }
    };
    const id = window.setInterval(tick, 8000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [token, order.status]);

  const stepIndex = order.status === 'picked_up' ? 3 : STEPS.findIndex((s) => s.key === order.status);
  const ready = order.status === 'ready';
  const ended = order.status === 'cancelled' || order.status === 'failed';

  return (
    <div className="flex flex-col gap-6">
      <div className={cx('panel relative flex flex-col items-center gap-2 p-6 text-center', ready ? 'bg-agave text-on-agave' : 'bg-paper text-paper-ink')}>
        <p className="font-hand text-xl">{ready ? '¡Ya está listo!' : 'Show this at the window'}</p>
        <p className="text-sm font-bold uppercase tracking-wide">Order</p>
        <p className="font-display text-[clamp(4rem,22vw,7rem)] leading-none tracking-wider" aria-label={`Order code ${order.code.split('').join(' ')}`}>
          {order.code}
        </p>
        <p className="text-lg font-bold">for {order.name}</p>
        {ready ? (
          <Star className="absolute -right-3 -top-4 h-14 w-14 text-marigold" />
        ) : null}
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {ended ? `Order ${order.status}` : `Order status: ${STEPS[Math.min(stepIndex, 2)]?.label ?? 'Picked up'}`}
      </div>

      {ended ? (
        <div className="panel bg-danger-fill p-5 text-on-chile">
          <p className="font-display text-h3 uppercase">{order.status === 'failed' ? 'Payment didn’t go through' : 'Order cancelled'}</p>
          <p className="mt-1 font-bold">
            {order.status === 'failed' ? 'Nothing was charged. ' : ''}Questions? Ask at the window.
          </p>
          <Link href="/order" className="mt-3 inline-block font-bold underline">
            Start a new order
          </Link>
        </div>
      ) : (
        <ol className="grid grid-cols-3 gap-2" aria-label="Order progress">
          {STEPS.map((s, i) => {
            const done = stepIndex > i;
            const current = stepIndex === i;
            return (
              <li
                key={s.key}
                aria-current={current ? 'step' : undefined}
                className={cx(
                  'flex flex-col items-center gap-1 rounded-sm border-[length:var(--line-thin)] border-outline p-2 text-center',
                  current && s.key === 'ready' && 'bg-agave text-on-agave shadow-hard-sm',
                  current && s.key !== 'ready' && 'bg-marigold text-on-marigold shadow-hard-sm',
                  done && 'bg-surface-2 text-ink',
                  !done && !current && 'bg-surface text-ink-muted',
                )}
              >
                <StepIcon state={done ? 'done' : current ? 'current' : 'todo'} ready={s.key === 'ready'} />
                <span className="font-display text-sm uppercase leading-tight">{s.label}</span>
                <span className="font-hand text-xs">{s.es}</span>
              </li>
            );
          })}
        </ol>
      )}

      {!ended ? (
        <p className="text-center text-lg">
          {order.status === 'picked_up' ? (
            <>Picked up. ¡Gracias!</>
          ) : ready ? (
            <strong>Come to the window and say “{order.code}”.</strong>
          ) : order.estimatedReadyAt ? (
            <>
              Ready around <strong>{clockTime(order.estimatedReadyAt)}</strong>.{' '}
              {order.smsOptIn ? 'We’ll text you when it’s ready.' : 'Keep this page open — it updates by itself.'}
            </>
          ) : null}
        </p>
      ) : null}

      <section className="panel p-4" aria-labelledby="items-h">
        <h2 id="items-h" className="font-display text-lg uppercase">
          What you ordered
        </h2>
        <ul className="mt-2 flex flex-col gap-2">
          {order.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>
                <span className="font-bold">
                  {l.qty}× {l.itemName}
                </span>
                <span className="block text-sm text-ink-muted">
                  {[l.variationName !== 'Regular' ? l.variationName : null, ...l.modifiers.map((m) => m.name), l.note ? `“${l.note}”` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className="tabular-nums">{money(l.unitCents * l.qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 border-t-2 border-surface-2 pt-2 text-sm tabular-nums">
          <dt>Subtotal</dt>
          <dd className="text-right">{money(order.subtotalCents)}</dd>
          <dt>Tax</dt>
          <dd className="text-right">{money(order.taxCents)}</dd>
          {order.tipCents ? (
            <>
              <dt>Tip</dt>
              <dd className="text-right">{money(order.tipCents)}</dd>
            </>
          ) : null}
          <dt className="text-base font-bold">Paid</dt>
          <dd className="text-right text-base font-bold">{money(order.totalCents)}</dd>
        </dl>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <p>
          <span className="font-bold">Pickup:</span> {location.name}, {location.address}
        </p>
        <Sticker tone="paper" tilt="b">
          <Link href="/find-us" className="no-underline">
            Map →
          </Link>
        </Sticker>
      </section>
    </div>
  );
}

function StepIcon({ state, ready }: { state: 'done' | 'current' | 'todo'; ready: boolean }) {
  if (state === 'done')
    return (
      <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6">
        <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (state === 'current' && !ready)
    return (
      <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 animate-spin [animation-duration:2.4s] motion-reduce:animate-none">
        <path d="M12 3a9 9 0 1 1-9 9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  if (state === 'current' && ready)
    return (
      <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6">
        <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z" fill="currentColor" />
      </svg>
    );
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="3 3" />
    </svg>
  );
}
