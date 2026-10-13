// Order status pill. A fulfilled order is the normal case, so callers usually
// show this only for the exceptions (open / cancelled / refunded): a column of
// identical badges is noise. Colours come from design tokens.
const STYLES: Record<string, string> = {
  open: 'text-warn border-[var(--warn)]',
  fulfilled: 'text-success border-[var(--success)]',
  cancelled: 'text-ink-3 border-[var(--ink-3)]',
  refunded: 'text-danger border-[var(--danger)]',
};

export function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const style = STYLES[status] ?? 'text-ink-2 border-[var(--rule)]';
  return (
    <span
      className={`inline-block rounded-[var(--radius-sm)] border px-1.5 py-px text-xs font-semibold uppercase tracking-wide ${style}`}
    >
      {status}
    </span>
  );
}
