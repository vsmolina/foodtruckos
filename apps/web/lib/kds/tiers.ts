// Kitchen lateness tiers — one source of truth for the KDS cards and the
// dashboard. Amber = caution (slow), red = warning (late); always shown with a
// word as well as a colour.

export const AMBER_MS = 3 * 60 * 1000;
export const DANGER_MS = 7 * 60 * 1000;

export type Tier = 'normal' | 'amber' | 'danger';

export function tierFor(elapsedMs: number): Tier {
  return elapsedMs >= DANGER_MS ? 'danger' : elapsedMs >= AMBER_MS ? 'amber' : 'normal';
}

export const TIER_WORD: Record<Tier, string | null> = { normal: null, amber: 'Slow', danger: 'Late' };
