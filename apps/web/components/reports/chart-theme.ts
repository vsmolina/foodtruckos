// Recharts theme: every color is a design-system token (see app/globals.css and
// docs/03-DESIGN-SYSTEM.md), so charts follow the palette without hex literals.
//
// Color jobs (validated with the dataviz palette checker on --bg-raised):
// - `emphasis` (--accent) marks the one series a chart is about, e.g. "today".
// - `context` (--ink-3) is the de-emphasis gray for comparison series; it is
//   always dashed + legended, so identity never rests on color alone.
// - `mark` (--ink-2) is the single-series default.
export const chart = {
  emphasis: 'var(--accent)',
  context: 'var(--ink-3)',
  mark: 'var(--ink-2)',
  surface: 'var(--bg-raised)',
  grid: 'var(--rule)',
  hover: 'var(--bg-sunken)',
  tick: { fill: 'var(--ink-3)', fontSize: 11, fontFamily: 'var(--font-mono)' },
  height: 260,
} as const;

// Mark specs: 2px lines, >= 8px end markers with a 2px surface ring, bars capped
// at 24px with a 4px rounded data-end.
export const LINE_WIDTH = 2;
export const DOT_R = 4;
export const BAR_SIZE = 18;

/** 0 → "12a", 13 → "1p". */
export function hourLabel(h: number): string {
  const suffix = h < 12 ? 'a' : 'p';
  return `${h % 12 === 0 ? 12 : h % 12}${suffix}`;
}

/**
 * Clean axis ticks from 0 to just past `max`, stepping by the smallest of
 * `steps` that keeps it to about `target` intervals (Recharts' own ticks give
 * odd steps like $45).
 */
export function niceTicks(max: number, steps: readonly number[], target = 4): number[] {
  const step = steps.find((s) => max / s <= target) ?? steps[steps.length - 1]!;
  const top = Math.max(step, Math.ceil(max / step) * step);
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}

/** Money steps in cents: $10 … $5K. */
export const MONEY_STEPS = [1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000, 200000, 500000] as const;
/** Duration steps in seconds: 30s … 30 min. */
export const DURATION_STEPS = [30, 60, 120, 180, 300, 600, 900, 1800] as const;

/** Axis money: $0, $40, $1.2K — whole dollars, compact past a thousand. */
export function moneyTick(cents: number): string {
  const dollars = cents / 100;
  return dollars >= 1000 ? `$${(dollars / 1000).toFixed(1)}K` : `$${Math.round(dollars)}`;
}
