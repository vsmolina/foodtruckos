// Ranked list with a single-hue bar behind each label; the number is always
// printed in ink (never only the bar).
export function BarList({
  rows,
  empty,
}: {
  rows: Array<{ label: string; n: number }>;
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-ink-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.n));
  return (
    <ol className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li
          key={r.label}
          className="relative flex min-h-9 items-center justify-between gap-3 overflow-hidden rounded-sm px-2"
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 rounded-sm bg-marigold/30"
            style={{ width: `${(r.n / max) * 100}%` }}
          />
          <span className="relative truncate text-sm font-bold">{r.label}</span>
          <span className="relative text-sm font-bold tabular-nums">
            {r.n.toLocaleString('en-US')}
          </span>
        </li>
      ))}
    </ol>
  );
}
