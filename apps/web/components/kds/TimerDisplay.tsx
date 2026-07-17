'use client';

import { memo } from 'react';
import { useNow } from './TimerContext';

function format(elapsedMs: number): string {
  const total = Math.max(0, Math.floor(elapsedMs / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Memoized: re-renders only when the ticking `now` changes, not on parent churn.
export const TimerDisplay = memo(function TimerDisplay({
  startedAt,
}: {
  startedAt: string;
}): React.JSX.Element {
  const now = useNow();
  const elapsed = now - new Date(startedAt).getTime();
  return (
    <span
      className="font-mono font-semibold tabular-nums"
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {format(elapsed)}
    </span>
  );
});
