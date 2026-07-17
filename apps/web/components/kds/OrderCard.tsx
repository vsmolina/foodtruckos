'use client';

import type { KdsTicket } from '@/lib/kds/types';
import { useNow } from './TimerContext';
import { TimerDisplay } from './TimerDisplay';

const AMBER_MS = 3 * 60 * 1000;
const DANGER_MS = 7 * 60 * 1000;

type Tier = 'normal' | 'amber' | 'danger';

function placedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  });
}

export function OrderCard({
  ticket,
  onComplete,
}: {
  ticket: KdsTicket;
  onComplete: (ticket: KdsTicket) => void;
}): React.JSX.Element {
  const now = useNow();
  const elapsed = now - new Date(ticket.startedAt).getTime();
  const tier: Tier = elapsed >= DANGER_MS ? 'danger' : elapsed >= AMBER_MS ? 'amber' : 'normal';

  const border =
    tier === 'danger'
      ? '2px solid var(--danger)'
      : tier === 'amber'
        ? '2px solid var(--warn)'
        : '1px solid var(--rule)';
  const background =
    tier === 'danger'
      ? 'color-mix(in srgb, var(--danger) 8%, var(--bg-raised))'
      : tier === 'amber'
        ? 'color-mix(in srgb, var(--warn) 6%, var(--bg-raised))'
        : 'var(--bg-raised)';

  return (
    <button
      type="button"
      onClick={() => onComplete(ticket)}
      className="flex h-full w-full flex-col overflow-hidden rounded-[var(--radius)] text-left outline-accent focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        border,
        background,
        animation: `kds-enter var(--dur-4) var(--ease-spring)${tier === 'danger' ? ', kds-pulse 1.5s ease-in-out infinite' : ''}`,
      }}
      aria-label={`Order ${ticket.number}, tap to complete`}
    >
      {/* Top bar: order number + live timer */}
      <div className="flex items-baseline justify-between border-b border-[var(--rule)] px-3 py-2">
        <span className="font-mono text-lg font-semibold tracking-tight text-ink">
          {ticket.number}
        </span>
        <span
          className="text-2xl leading-none text-ink"
          style={{ color: tier === 'danger' ? 'var(--danger)' : tier === 'amber' ? 'var(--warn)' : undefined }}
        >
          <TimerDisplay startedAt={ticket.startedAt} />
        </span>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-hidden px-3 py-2">
        {ticket.items.map((it, i) => (
          <div key={i} className="mb-1.5">
            <div className="text-[15px] font-medium leading-tight text-ink">
              <span className="font-mono text-ink-2">{it.qty}×</span> {it.name}
            </div>
            {it.modifiers.map((m, j) => (
              <div key={j} className="pl-4 text-[13px] leading-tight text-ink-3">
                – {m}
              </div>
            ))}
            {it.notes ? (
              <div className="pl-4 text-[13px] italic leading-tight text-warn">– {it.notes}</div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Bottom bar: placed time */}
      <div className="flex items-center justify-between border-t border-[var(--rule)] px-3 py-1.5 text-[12px] uppercase tracking-wide text-ink-3">
        <span>Order</span>
        <span className="font-mono">{placedTime(ticket.placedAt)}</span>
      </div>
    </button>
  );
}
