// Dashboard form primitives per docs/03-DESIGN-SYSTEM.md: underline inputs,
// label above input, accent only on the primary action and the focus state.

export const inputClass =
  'min-w-0 border-0 border-b border-[var(--rule)] bg-transparent px-0 py-1 text-sm text-ink placeholder:text-ink-3 focus:border-[var(--accent)] focus:outline-none';

export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs uppercase tracking-wide text-ink-3">{label}</span>
      {children}
      {hint ? <span className="text-xs text-ink-3">{hint}</span> : null}
    </label>
  );
}

export function PrimaryButton({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <button
      type="submit"
      className="rounded-[var(--radius)] bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:opacity-90"
    >
      {children}
    </button>
  );
}

export function QuietButton({
  children,
  formAction,
  label,
}: {
  children: React.ReactNode;
  formAction?: (fd: FormData) => Promise<void>;
  /** Accessible name when the visible text is a symbol (e.g. ↑). */
  label?: string;
}): React.JSX.Element {
  return (
    <button
      type="submit"
      formAction={formAction}
      aria-label={label}
      title={label}
      className="whitespace-nowrap rounded-[var(--radius)] px-2 py-1 text-sm text-ink-2 hover:bg-bg-sunken hover:text-ink"
    >
      {children}
    </button>
  );
}

/**
 * Two-step delete without a JS confirm(): "Delete" opens a disclosure that
 * explains the consequence and holds the real submit button.
 */
export function DeleteConfirm({
  action,
  what,
  consequence,
}: {
  action: () => Promise<void>;
  what: string;
  consequence: string;
}): React.JSX.Element {
  return (
    <details className="group relative inline-block">
      <summary className="cursor-pointer list-none rounded-[var(--radius)] px-2 py-1 text-sm text-ink-3 hover:bg-bg-sunken hover:text-danger">
        Delete
      </summary>
      <div className="absolute right-0 z-10 mt-1 w-64 rounded-[var(--radius)] border border-[var(--rule)] bg-bg-raised p-3 text-sm shadow-sm">
        <p className="text-ink">Delete {what}?</p>
        <p className="mt-1 text-xs text-ink-3">{consequence}</p>
        <form action={action} className="mt-3">
          <button
            type="submit"
            className="rounded-[var(--radius)] border border-[var(--danger)] px-2.5 py-1 text-sm font-medium text-danger hover:bg-[var(--danger)] hover:text-bg-raised"
          >
            Delete {what}
          </button>
        </form>
      </div>
    </details>
  );
}

export function NoticeBanner({
  notice,
}: {
  notice: { tone: 'ok' | 'error'; text: string } | null;
}): React.JSX.Element | null {
  if (!notice) return null;
  const tone =
    notice.tone === 'error' ? 'border-[var(--danger)] text-danger' : 'border-[var(--success)] text-success';
  return (
    <div role={notice.tone === 'error' ? 'alert' : 'status'} className={`mt-4 border-l-2 px-3 py-1.5 text-sm ${tone}`}>
      {notice.text}
    </div>
  );
}
