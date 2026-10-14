// Small building blocks shared by the Website tabs, in the dashboard's own
// design language (docs/03-DESIGN-SYSTEM.md): raised white panels, hairline
// rules, accent only on primary actions.

export function Panel({
  title,
  description,
  actions,
  children,
  className = '',
}: {
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <section className={`rounded-[var(--radius-lg)] border border-[var(--rule)] bg-bg-raised p-5 ${className}`}>
      {title || actions ? (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            {title ? <h2 className="font-display text-xl text-ink">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-sm text-ink-3">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Neutral / ok / warn / danger pill. Always carries a word, never colour alone. */
export function Pill({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent';
  children: React.ReactNode;
}): React.JSX.Element {
  const cls = {
    neutral: 'border-[var(--rule)] text-ink-2',
    ok: 'border-[var(--success)] text-success',
    warn: 'border-[var(--warn)] text-warn',
    danger: 'border-[var(--danger)] text-danger',
    accent: 'border-[var(--accent)] text-accent',
  }[tone];
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-px text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="py-8 text-center text-sm text-ink-3">{children}</p>;
}

/** Secondary button-styled link (e.g. "New special"). */
export function ButtonLink({
  href,
  children,
  primary = false,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
  external?: boolean;
}): React.JSX.Element {
  const cls = primary
    ? 'bg-accent text-accent-ink hover:opacity-90'
    : 'border border-[var(--rule)] text-ink-2 hover:bg-bg-sunken hover:text-ink';
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className={`inline-flex items-center whitespace-nowrap rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium ${cls}`}
    >
      {children}
    </a>
  );
}

export const textareaClass =
  'min-h-20 w-full rounded-[var(--radius)] border border-[var(--rule)] bg-transparent px-2 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:border-[var(--accent)] focus:outline-none';

export const selectClass =
  'min-w-0 border-0 border-b border-[var(--rule)] bg-transparent px-0 py-1 text-sm text-ink focus:border-[var(--accent)] focus:outline-none';
