import type { SpecialDto } from '@barrio/site-contract';
import { dateTime } from '@/lib/format';
import { Pill } from '@/components/website/ui';

const STATE: Record<SpecialDto['state'], { tone: 'ok' | 'warn' | 'neutral'; word: string }> = {
  live: { tone: 'ok', word: 'Live' },
  scheduled: { tone: 'warn', word: 'Scheduled' },
  ended: { tone: 'neutral', word: 'Ended' },
  off: { tone: 'neutral', word: 'Off' },
};

/** State pill plus the schedule, in San Marcos time. */
export function StateLine({ special }: { special: SpecialDto }): React.JSX.Element {
  const st = STATE[special.state];
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
      <Pill tone={st.tone}>{st.word}</Pill>
      {special.startsAt ? <span>from {dateTime(special.startsAt)}</span> : null}
      {special.endsAt ? <span>until {dateTime(special.endsAt)}</span> : null}
      {!special.startsAt && !special.endsAt ? <span>no end date</span> : null}
    </div>
  );
}
