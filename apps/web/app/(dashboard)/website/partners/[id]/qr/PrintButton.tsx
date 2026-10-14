'use client';

export function PrintButton(): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-[var(--radius)] bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:opacity-90"
    >
      Print card
    </button>
  );
}
