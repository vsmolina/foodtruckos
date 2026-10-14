import type { Cell } from '@/lib/analytics';
import { cx } from '@/lib/cx';

// Weekday × hour heatmap as a real table. One hue (marigold), sequential:
// faint → full by count, every cell labelled with its number so colour is
// never the only carrier. Night hours 6 PM → 4 AM, plus "Other hours".

export const NIGHT_HOURS = [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4] as const;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const label = (h: number) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`);

/** Thursday & Friday 8–10 PM: the slow early-evening window under study. */
export const WATCH = { days: [4, 5], hours: [20, 21] };

export function Heatmap({
  caption,
  cells,
  unit,
}: {
  caption: string;
  cells: Cell[];
  unit: string;
}) {
  const at = (d: number, h: number) => cells.find((c) => c.day === d && c.hour === h)?.n ?? 0;
  const other = (d: number) =>
    cells
      .filter((c) => c.day === d && !(NIGHT_HOURS as readonly number[]).includes(c.hour))
      .reduce((n, c) => n + c.n, 0);
  const max = Math.max(
    1,
    ...cells.filter((c) => (NIGHT_HOURS as readonly number[]).includes(c.hour)).map((c) => c.n),
  );

  const fill = (n: number) => {
    if (n === 0) return { pct: 0 };
    return { pct: Math.round(18 + (82 * n) / max) }; // 18%–100% marigold over the surface
  };

  return (
    <section className="rounded-md border-2 border-outline bg-surface p-2">
      <h2 className="px-2 pt-1 text-base font-bold">{caption}</h2>
      <p className="px-2 pb-2 text-sm text-ink-muted">
        {unit}; after-midnight hours count toward the night they started
      </p>
      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label={`${caption} (scrolls sideways)`}
      >
        <table className="w-full min-w-[640px] border-separate border-spacing-0.5 text-center text-sm tabular-nums">
          <caption className="sr-only">
            {caption}, {unit}, by weekday and hour
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-12 text-left text-xs text-ink-muted">
                <span className="sr-only">Night</span>
              </th>
              {NIGHT_HOURS.map((h) => (
                <th key={h} scope="col" className="px-1 text-xs font-bold text-ink-muted">
                  {label(h)}
                </th>
              ))}
              <th scope="col" className="px-1 text-xs font-bold text-ink-muted">
                Other
              </th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((name, i) => {
              const d = i + 1;
              return (
                <tr key={name}>
                  <th scope="row" className="pr-1 text-left font-bold">
                    {name}
                  </th>
                  {NIGHT_HOURS.map((h) => {
                    const n = at(d, h);
                    const { pct } = fill(n);
                    const watched = WATCH.days.includes(d) && WATCH.hours.includes(h);
                    return (
                      <td
                        key={h}
                        className={cx(
                          'h-9 min-w-10 rounded-sm',
                          pct >= 55 ? 'text-on-marigold font-bold' : 'text-ink',
                          watched &&
                            'outline-2 outline-offset-[-2px] outline-dashed outline-[var(--rosa)]',
                        )}
                        style={{
                          background: pct
                            ? `color-mix(in oklab, var(--marigold) ${pct}%, var(--surface))`
                            : 'var(--surface-2)',
                        }}
                      >
                        {n || <span className="text-ink-muted">·</span>}
                      </td>
                    );
                  })}
                  <td className="h-9 min-w-12 rounded-sm bg-surface-2">
                    {other(d) || <span className="text-ink-muted">·</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** The watched window vs an average 2-hour night slot. */
export function watchSummary(cells: Cell[]): {
  window: number;
  avgSlot: number;
  share: number;
  total: number;
} {
  const night = cells.filter((c) => (NIGHT_HOURS as readonly number[]).includes(c.hour));
  const total = night.reduce((n, c) => n + c.n, 0);
  const window = night
    .filter((c) => WATCH.days.includes(c.day) && WATCH.hours.includes(c.hour))
    .reduce((n, c) => n + c.n, 0);
  // 7 nights × 11 hours = 77 hour-cells → average for a 2-day × 2-hour block (4 cells).
  const avgSlot = (total / (7 * NIGHT_HOURS.length)) * 4;
  return { window, avgSlot, share: total ? window / total : 0, total };
}
