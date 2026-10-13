'use client';

import { useEffect, useState } from 'react';
import type { KdsTicket } from '@/lib/kds/types';
import { placedTime } from './OrderCard';

// Recently completed tickets, newest first. "Bring back" re-opens one on the
// board with its original start time (cleared by mistake, or remade).
export function RecentPanel({
  loadRecent,
  onRecall,
  onClose,
}: {
  loadRecent: (reply: (list: KdsTicket[]) => void) => void;
  onRecall: (ticket: KdsTicket) => void;
  onClose: () => void;
}): React.JSX.Element {
  const [tickets, setTickets] = useState<KdsTicket[] | null>(null);

  useEffect(() => {
    loadRecent(setTickets);
  }, [loadRecent]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const recall = (t: KdsTicket): void => {
    onRecall(t);
    setTickets((prev) => prev?.filter((x) => x.id !== t.id) ?? null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Recent orders"
    >
      <div
        className="flex max-h-[86vh] w-[min(640px,92vw)] flex-col rounded-[var(--radius-lg)] bg-bg-raised"
        style={{ boxShadow: 'var(--shadow-pop, 0 8px 24px -8px rgba(0,0,0,0.5))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--rule)] px-5 py-3">
          <div className="font-display text-2xl text-ink">Recent orders</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius)] border border-[var(--rule)] px-4 py-2 font-medium text-ink outline-accent focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Close
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-2">
          {tickets === null ? (
            <div className="py-8 text-center text-ink-3">Loading…</div>
          ) : tickets.length === 0 ? (
            <div className="py-8 text-center text-ink-3">No completed orders yet.</div>
          ) : (
            tickets.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-4 border-b border-[var(--rule)] py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-lg font-semibold text-ink">{t.number}</span>
                    <span className="font-mono text-[12px] uppercase tracking-wide text-ink-3">
                      in {placedTime(t.placedAt)}
                      {t.completedAt ? ` · done ${placedTime(t.completedAt)}` : ''}
                    </span>
                  </div>
                  <div className="truncate text-[14px] text-ink-2">
                    {t.items.map((it) => `${it.qty}× ${it.name}`).join(', ')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => recall(t)}
                  aria-label={`Bring back ${t.number}`}
                  className="shrink-0 rounded-[var(--radius)] px-4 py-3 font-semibold outline-accent focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
                >
                  Bring back
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
