import Link from 'next/link';
import { hhmm } from '@/lib/format';
import { cx } from '@/lib/cx';
import type { DayHours, OrderingState, Settings } from '@/lib/status';

// The first thing on every public page: are we open? Status word + colour +
// shape (dot/clock/moon), never colour alone. Comes from site_settings — the
// single source of truth set in /admin/status (or by the POS integration).

export function StatusBanner({ settings, today, ordering }: { settings: Settings; today: DayHours | undefined; ordering: OrderingState }) {
  const s = settings.status;
  const hours = today && !today.closed && today.opens ? `${hhmm(today.opens)} – ${hhmm(today.closes)}` : null;

  const label = s === 'open' ? 'Open now' : s === 'back_soon' ? 'Back soon' : 'Closed';
  const tone =
    s === 'open' ? 'bg-agave text-on-agave' : s === 'back_soon' ? 'bg-marigold text-on-marigold' : 'bg-danger-fill text-on-chile';

  const detail =
    s === 'open'
      ? ordering.canOrder
        ? `Order ahead · ~${ordering.waitMinutes} min`
        : ordering.reason === 'paused'
          ? (settings.pausedMessage ?? 'Online orders paused — order at the window')
          : null
      : (settings.statusMessage ?? (hours ? `Tonight ${hours}` : null));

  return (
    <div className={cx('relative z-10 border-b-[length:var(--line)] border-outline', tone)} role="status" aria-live="polite">
      <Link
        href={s === 'open' && ordering.canOrder ? '/order' : '/find-us'}
        className="mx-auto flex min-h-11 max-w-6xl items-center gap-3 px-4 py-1.5 no-underline"
      >
        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap font-display text-base uppercase tracking-wide">
          <StatusIcon status={s} />
          {label}
        </span>
        <span className="min-w-0 truncate text-sm font-bold">
          {detail}
          {s === 'open' && hours ? <span className="hidden sm:inline"> · till {hhmm(today?.closes)}</span> : null}
        </span>
        <span aria-hidden className="ml-auto shrink-0 font-display text-base">→</span>
      </Link>
    </div>
  );
}

export function StatusIcon({ status, className }: { status: Settings['status']; className?: string }) {
  if (status === 'open')
    return <span aria-hidden className={cx('pulse-open inline-block h-3 w-3 rounded-full border-2 border-outline bg-paper', className)} />;
  if (status === 'back_soon')
    return (
      <svg aria-hidden viewBox="0 0 20 20" className={cx('h-4 w-4', className)}>
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M10 5v5l3 2" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={cx('h-4 w-4', className)}>
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
