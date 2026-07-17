'use client';

import { useEffect } from 'react';
import type { KdsTicket } from '@/lib/kds/types';

// Two-step confirm so a fat-finger during a rush doesn't clear an order.
export function CompleteConfirmModal({
  ticket,
  onConfirm,
  onCancel,
}: {
  ticket: KdsTicket;
  onConfirm: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-[min(420px,86vw)] rounded-[var(--radius-lg)] bg-bg-raised p-6 text-center"
        style={{ boxShadow: 'var(--shadow-pop, 0 8px 24px -8px rgba(0,0,0,0.5))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-display text-2xl text-ink">Complete {ticket.number}?</div>
        <p className="mt-1 text-ink-3">This removes the order from the board.</p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-[var(--radius)] border border-[var(--rule)] px-4 py-3 font-medium text-ink outline-accent focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className="flex-1 rounded-[var(--radius)] px-4 py-3 font-semibold outline-accent focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            ✓ Done
          </button>
        </div>
      </div>
    </div>
  );
}
