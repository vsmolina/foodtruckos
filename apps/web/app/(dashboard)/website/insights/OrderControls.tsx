'use client';

import type { WebOrderState } from '@barrio/site-contract';
import { ActionForm } from '@/components/website/ActionForm';
import { setOrderStatus } from './actions';

const btn =
  'whitespace-nowrap rounded-[var(--radius)] border border-[var(--rule)] px-2.5 py-1 text-sm text-ink-2 hover:bg-bg-sunken hover:text-ink';

export function OrderControls({ id, status }: { id: string; status: WebOrderState }): React.JSX.Element {
  return (
    <ActionForm action={setOrderStatus.bind(null, id)} className="flex flex-wrap items-center gap-2">
      {status === 'received' ? (
        <button type="submit" name="status" value="preparing" className={btn}>
          Preparing
        </button>
      ) : null}
      {status !== 'ready' ? (
        <button type="submit" name="status" value="ready" className={btn}>
          Ready (texts them)
        </button>
      ) : null}
      <button type="submit" name="status" value="picked_up" className={btn}>
        Picked up
      </button>
      <details className="relative">
        <summary className="cursor-pointer list-none rounded-[var(--radius)] px-2.5 py-1 text-sm text-ink-3 hover:bg-bg-sunken hover:text-danger">
          Cancel…
        </summary>
        <div className="absolute left-0 z-10 mt-1 w-64 rounded-[var(--radius)] border border-[var(--rule)] bg-bg-raised p-3 text-sm shadow-sm">
          <p className="text-ink">Cancel this order?</p>
          <p className="mt-1 text-xs text-ink-3">This doesn’t refund the card — refund it in the Square Dashboard.</p>
          <button
            type="submit"
            name="status"
            value="cancelled"
            className="mt-3 rounded-[var(--radius)] border border-[var(--danger)] px-2.5 py-1 text-sm font-medium text-danger hover:bg-[var(--danger)] hover:text-bg-raised"
          >
            Cancel order
          </button>
        </div>
      </details>
    </ActionForm>
  );
}
