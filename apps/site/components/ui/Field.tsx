import type { ComponentProps, ReactNode } from 'react';
import { cx } from '@/lib/cx';

// Form fields: labels always visible (never placeholder-only), 48px+ targets,
// errors in text + icon (never colour alone), linked with aria-describedby.

const INPUT =
  'block w-full min-h-12 rounded-sm border-[length:var(--line-thin)] border-outline bg-paper px-3 py-2.5 text-base text-paper-ink shadow-hard-sm placeholder:text-[#7a6d60] ' +
  'focus:outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ' +
  'aria-invalid:border-danger-fill aria-invalid:shadow-[3px_3px_0_0_var(--danger-fill)] disabled:opacity-60';

type FieldShell = {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  required?: boolean | undefined;
  className?: string | undefined;
};

function Shell({ name, label, hint, error, required, className, children }: FieldShell & { children: ReactNode }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={name} className="text-sm font-bold text-ink">
        {label}
        {required ? <span aria-hidden className="text-danger"> *</span> : null}
      </label>
      {hint ? (
        <p id={`${name}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {children}
      <FieldError name={name} error={error} />
    </div>
  );
}

export function FieldError({ name, error }: { name: string; error?: string | undefined }) {
  if (!error) return null;
  return (
    <p id={`${name}-error`} className="flex items-start gap-1.5 text-sm font-bold text-danger" role="alert">
      <span aria-hidden>✕</span>
      {error}
    </p>
  );
}

function describedBy(name: string, hint: unknown, error: unknown): string | undefined {
  const ids = [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

export function TextField({
  name,
  label,
  hint,
  error,
  required,
  className,
  ...input
}: FieldShell & Omit<ComponentProps<'input'>, 'name'>) {
  return (
    <Shell name={name} label={label} hint={hint} error={error} required={required} className={className}>
      <input
        id={name}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={INPUT}
        {...input}
      />
    </Shell>
  );
}

export function TextArea({
  name,
  label,
  hint,
  error,
  required,
  className,
  ...input
}: FieldShell & Omit<ComponentProps<'textarea'>, 'name'>) {
  return (
    <Shell name={name} label={label} hint={hint} error={error} required={required} className={className}>
      <textarea
        id={name}
        name={name}
        required={required}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={INPUT}
        {...input}
      />
    </Shell>
  );
}

export function SelectField({
  name,
  label,
  hint,
  error,
  required,
  className,
  options,
  placeholder,
  ...input
}: FieldShell &
  Omit<ComponentProps<'select'>, 'name'> & { options: ReadonlyArray<{ value: string; label: string }>; placeholder?: string }) {
  return (
    <Shell name={name} label={label} hint={hint} error={error} required={required} className={className}>
      <select
        id={name}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={cx(INPUT, 'appearance-none bg-[length:14px] bg-[right_12px_center] bg-no-repeat pr-9')}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 10'%3E%3Cpath d='M1 2l6 6 6-6' fill='none' stroke='%2314110E' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
        }}
        {...input}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Shell>
  );
}

/** Checkbox with a real label; consent boxes are never pre-checked. */
export function Checkbox({
  name,
  label,
  error,
  className,
  value = 'yes',
  ...input
}: { name: string; label: ReactNode; error?: string | undefined; className?: string } & Omit<ComponentProps<'input'>, 'name' | 'type'>) {
  const id = `${name}-${String(value)}`;
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-snug text-ink">
        <input
          id={id}
          type="checkbox"
          name={name}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
          className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer appearance-none rounded-sm border-[length:var(--line-thin)] border-outline bg-paper shadow-hard-sm checked:bg-marigold checked:bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2024%2024%22%3E%3Cpath%20d=%22M5%2013l4%204L19%207%22%20fill=%22none%22%20stroke=%22%2314110E%22%20stroke-width=%223.5%22%20stroke-linecap=%22round%22/%3E%3C/svg%3E')] bg-center bg-no-repeat"
          {...input}
        />
        <span>{label}</span>
      </label>
      <FieldError name={name} error={error} />
    </div>
  );
}

/** Spam trap: hidden from people and assistive tech; bots fill it. */
export function Honeypot() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Company website
        <input type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}

/** Banner for a whole-form error or success. */
export function FormNotice({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'rounded-sm border-[length:var(--line-thin)] border-outline p-3 font-bold shadow-hard-sm',
        tone === 'error' ? 'bg-danger-fill text-on-chile' : 'bg-agave text-on-agave',
      )}
    >
      {children}
    </div>
  );
}
