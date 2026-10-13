import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

// Admin UI: the same tokens as the public site, without the handmade
// treatments (no tilts, doodles or display-face body copy). Clarity first.

export function AdminPage({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-h3 uppercase">{title}</h1>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, children, className }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-md border-2 border-outline bg-surface p-4', className)}>
      {title ? <h2 className="mb-3 text-lg font-bold">{title}</h2> : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-md border-2 border-outline bg-surface p-4">
      <p className="text-sm font-bold text-ink-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-sm text-ink-muted">{hint}</p> : null}
    </div>
  );
}

const PILL: Record<string, string> = {
  green: 'bg-agave text-on-agave',
  amber: 'bg-marigold text-on-marigold',
  red: 'bg-danger-fill text-on-chile',
  blue: 'bg-anil text-on-anil',
  grey: 'bg-surface-2 text-ink',
  pink: 'bg-rosa text-on-rosa',
};

export function Pill({ tone = 'grey', children }: { tone?: keyof typeof PILL; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center rounded-sm border-2 border-outline px-1.5 py-0.5 text-xs font-bold uppercase', PILL[tone])}>
      {children}
    </span>
  );
}

/** Mobile-friendly list row (tables collapse badly on phones). */
export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={cx('flex flex-col gap-1 border-b-2 border-surface-2 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4', className)}>{children}</li>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border-2 border-dashed border-ink-muted p-6 text-center text-ink-muted">{children}</p>;
}
