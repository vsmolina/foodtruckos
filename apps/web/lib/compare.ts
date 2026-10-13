import type { Delta } from '@/components/dashboard/StatTile';

/**
 * Compare today against a reference period, as a StatTile delta.
 * `higherIsBetter` picks whether "up" is good news (sales) or bad (ticket time).
 */
export function compare(
  now: number | null,
  then: number | null,
  label: string,
  higherIsBetter: boolean,
): Delta {
  if (now == null) return { text: `no data yet today`, direction: null, good: null };
  if (then == null || then === 0) return { text: `nothing ${label} to compare`, direction: null, good: null };
  const pct = Math.round(((now - then) / then) * 100);
  if (pct === 0) return { text: `same as ${label}`, direction: null, good: null };
  const up = pct > 0;
  return {
    text: `${up ? '+' : ''}${pct}% vs ${label}`,
    direction: up ? 'up' : 'down',
    good: up === higherIsBetter,
  };
}
