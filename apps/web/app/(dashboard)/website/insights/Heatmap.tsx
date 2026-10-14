import type { HeatCell } from '@barrio/site-contract';

// Weekday × hour heatmap as a real table: one hue (the accent), sequential
// light → strong by count, and every cell prints its number, so colour is never
// the only carrier. Text stays in ink tokens; the fill is capped at 60% so ink
// keeps ≥ 4.5:1 on it in both themes. Night hours 6 PM → 4 AM, plus "Other".

export const NIGHT_HOURS = [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4] as const;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const hourLabel = (h: number) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`);

/** Thursday & Friday 8–10 PM: the slow early-evening window under study. */
const WATCH = { days: [4, 5], hours: [20, 21] };

export function Heatmap({ title, cells, unit }: { title: string; cells: HeatCell[]; unit: string }): React.JSX.Element {
  const night = (h: number) => (NIGHT_HOURS as readonly number[]).includes(h);
  const at = (d: number, h: number) => cells.find((c) => c.day === d && c.hour === h)?.n ?? 0;
  const other = (d: number) => cells.filter((c) => c.day === d && !night(c.hour)).reduce((n, c) => n + c.n, 0);
  const max = Math.max(1, ...cells.filter((c) => night(c.hour)).map((c) => c.n));
  const pct = (n: number) => (n === 0 ? 0 : Math.round(10 + (50 * n) / max));

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--rule)] bg-bg-raised p-5">
      <h3 className="font-display text-lg text-ink">{title}</h3>
      <p className="mt-0.5 text-sm text-ink-3">
        {`${unit} by night and hour. After-midnight hours count toward the night they started. Dashed cells: Thu & Fri 8–10 PM.`}
      </p>
      <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label={`${title} (scrolls sideways)`}>
        <table className="w-full min-w-[560px] border-separate border-spacing-0.5 text-center text-sm tabular-nums">
          <caption className="sr-only">
            {title}: {unit} by weekday and hour
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-10 text-left text-xs font-normal text-ink-3">
                <span className="sr-only">Night</span>
              </th>
              {NIGHT_HOURS.map((h) => (
                <th key={h} scope="col" className="px-1 text-xs font-normal text-ink-3">
                  {hourLabel(h)}
                </th>
              ))}
              <th scope="col" className="px-1 text-xs font-normal text-ink-3">
                Other
              </th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((name, i) => {
              const d = i + 1;
              return (
                <tr key={name}>
                  <th scope="row" className="pr-1 text-left text-sm font-medium text-ink">
                    {name}
                  </th>
                  {NIGHT_HOURS.map((h) => {
                    const n = at(d, h);
                    const p = pct(n);
                    const watched = WATCH.days.includes(d) && WATCH.hours.includes(h);
                    return (
                      <td
                        key={h}
                        title={`${DAY_LONG[i]} ${hourLabel(h)}: ${n} ${unit.toLowerCase()}`}
                        className={`h-8 min-w-9 rounded-[var(--radius-sm)] text-ink ${watched ? 'outline-2 -outline-offset-2 outline-dashed outline-[var(--ink-3)]' : ''}`}
                        style={{ background: p ? `color-mix(in oklab, var(--accent) ${p}%, var(--bg-raised))` : 'var(--bg-sunken)' }}
                      >
                        {n || <span className="text-ink-3">·</span>}
                      </td>
                    );
                  })}
                  <td className="h-8 min-w-10 rounded-[var(--radius-sm)] bg-bg-sunken text-ink" title={`${DAY_LONG[i]}, other hours: ${other(d)}`}>
                    {other(d) || <span className="text-ink-3">·</span>}
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

/** Ranked rows with a thin bar; the number is always printed. */
export function BarList({ rows, empty }: { rows: Array<{ label: string; n: number }>; empty: string }): React.JSX.Element {
  if (rows.length === 0) return <p className="py-4 text-sm text-ink-3">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-t border-[var(--rule)] first:border-0">
            <th scope="row" className="max-w-0 py-1.5 pr-3 text-left font-normal text-ink">
              <span className="block truncate" title={r.label}>
                {r.label}
              </span>
              <span aria-hidden className="mt-1 block h-1 rounded-full bg-accent" style={{ width: `${Math.max(2, (r.n / max) * 100)}%` }} />
            </th>
            <td className="w-14 py-1.5 text-right tabular-nums text-ink">{r.n.toLocaleString('en-US')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
