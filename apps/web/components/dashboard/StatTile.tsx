// A KPI tile: label, value, and — the part that makes a number mean something —
// a comparison against a named period. Value uses the sans with proportional
// figures (tabular digits look loose at display size).

export type Delta = {
  /** e.g. "+12% vs last Mon" or "no sales last Mon yet". */
  text: string;
  /** Arrow direction; null = no arrow. */
  direction: 'up' | 'down' | null;
  /** Is this change good news? Picks the colour; null = neutral. */
  good: boolean | null;
};

export function StatTile({
  label,
  value,
  delta,
  hint,
  hero = false,
  children,
}: {
  label: string;
  value: string;
  delta?: Delta;
  hint?: React.ReactNode;
  /** The one number the page leads with — larger. */
  hero?: boolean;
  children?: React.ReactNode;
}): React.JSX.Element {
  const tone =
    delta?.good == null ? 'text-ink-3' : delta.good ? 'text-success' : 'text-danger';
  return (
    <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--rule)] bg-bg-raised p-5 shadow-[0_1px_2px_rgba(20,17,14,0.06)]">
      <div className="text-sm font-medium text-ink-2">{label}</div>
      <div
        className={`mt-1 font-sans font-semibold leading-none tracking-tight text-ink ${hero ? 'text-5xl' : 'text-4xl'}`}
      >
        {value}
      </div>
      {delta ? (
        <div className={`mt-2 text-sm font-medium ${tone}`}>
          {delta.direction === 'up' ? '▲ ' : delta.direction === 'down' ? '▼ ' : ''}
          {delta.text}
        </div>
      ) : null}
      {hint ? <div className="mt-1 text-sm text-ink-3">{hint}</div> : null}
      {children}
    </div>
  );
}
