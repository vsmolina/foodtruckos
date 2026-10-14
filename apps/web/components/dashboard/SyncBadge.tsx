// Square sync state for a menu item/category. Always a text label + mark, never
// color alone; the latest error rides along as a tooltip.
const STYLE = {
  synced: { label: 'In Square', mark: '✓', cls: 'text-success' },
  pending: { label: 'Syncing…', mark: '↻', cls: 'text-warn' },
  error: { label: 'Sync failed', mark: '!', cls: 'text-danger' },
  local: { label: 'Not in Square', mark: '○', cls: 'text-ink-3' },
} as const;

export type SyncStatus = keyof typeof STYLE;

export function SyncBadge({
  status,
  error,
}: {
  status: SyncStatus;
  error?: string | null;
}): React.JSX.Element {
  const s = STYLE[status];
  // While retries remain the row is still 'pending' but carries the last error.
  const label = status === 'pending' && error ? 'Retrying…' : s.label;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium uppercase tracking-wide ${s.cls}`}
      title={error ?? undefined}
    >
      <span aria-hidden>{s.mark}</span>
      {label}
    </span>
  );
}
