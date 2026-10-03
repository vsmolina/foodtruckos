// A single KPI tile: big value, small label, optional hint. Design-system
// tokens only — no generic card look.
export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}): React.JSX.Element {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--rule)] bg-bg-raised p-4">
      <div className="text-xs uppercase tracking-wide text-ink-3">{label}</div>
      <div className="mt-1 font-mono text-3xl font-semibold text-ink tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-ink-3">{hint}</div> : null}
    </div>
  );
}
