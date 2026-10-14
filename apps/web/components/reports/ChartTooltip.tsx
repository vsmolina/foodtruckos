'use client';

// One tooltip for every chart: values lead (strong, mono), series names follow
// (muted); rows keyed with a short line in the series color, never a filled box.
export type TooltipRow = { key: string; label: string; value: string; color: string; dashed?: boolean };

export function ChartTooltip({ title, rows }: { title: string; rows: TooltipRow[] }): React.JSX.Element {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-bg-raised px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 text-ink-3">{title}</div>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2">
          <svg width="14" height="4" aria-hidden>
            <line
              x1="0"
              y1="2"
              x2="14"
              y2="2"
              stroke={r.color}
              strokeWidth="2"
              strokeDasharray={r.dashed ? '3 2' : undefined}
            />
          </svg>
          <span className="font-mono font-semibold tabular-nums text-ink">{r.value}</span>
          <span className="text-ink-3">{r.label}</span>
        </div>
      ))}
    </div>
  );
}
