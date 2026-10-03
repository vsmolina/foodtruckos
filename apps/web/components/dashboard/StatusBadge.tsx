// Order status pill. Colors come from design tokens so light/dark stay in sync.
const STYLES: Record<string, string> = {
  open: 'text-warn border-[var(--warn)]',
  fulfilled: 'text-success border-[var(--success)]',
  cancelled: 'text-ink-3 border-[var(--rule)]',
  refunded: 'text-danger border-[var(--danger)]',
};

export function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const style = STYLES[status] ?? 'text-ink-2 border-[var(--rule)]';
  return (
    <span
      className={`inline-block rounded-[var(--radius-sm)] border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${style}`}
    >
      {status}
    </span>
  );
}
