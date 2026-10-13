import { tierFor, TIER_WORD } from '@/lib/kds/tiers';
import { duration } from '@/lib/format';

// Kitchen time with the KDS lateness tier: the same 3 / 7 min thresholds and
// colours as the ticket headers, plus the word, so it reads without colour.
export function TicketTime({
  seconds,
  cooking = false,
}: {
  seconds: number | null;
  /** Still on the board: no finish time yet. */
  cooking?: boolean;
}): React.JSX.Element {
  if (seconds == null) {
    return <span className="text-ink-3">{cooking ? 'cooking…' : '—'}</span>;
  }
  const tier = tierFor(seconds * 1000);
  const word = TIER_WORD[tier];
  return (
    <span className="inline-flex items-center justify-end gap-2">
      {word ? (
        <span
          className="rounded-[var(--radius-sm)] px-1.5 text-[11px] font-bold uppercase leading-[1.6] tracking-wide"
          style={
            tier === 'danger'
              ? { background: 'var(--status-red)', color: '#fff' }
              : { background: 'var(--status-amber)', color: '#1a1206' }
          }
        >
          {word}
        </span>
      ) : null}
      <span className="font-mono tabular-nums text-ink">{duration(seconds)}</span>
    </span>
  );
}
