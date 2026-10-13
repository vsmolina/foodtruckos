import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cx } from '@/lib/cx';

// Buttons press into their hard shadow (utility `press`). Variants are flat
// mural fills with a black outline; never gradients. Min height 48px.

export type ButtonVariant = 'primary' | 'marigold' | 'paper' | 'ghost' | 'danger' | 'agave';
type Size = 'md' | 'lg' | 'sm';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-chile text-on-chile',
  marigold: 'bg-marigold text-on-marigold',
  agave: 'bg-agave text-on-agave',
  paper: 'bg-paper text-paper-ink',
  danger: 'bg-danger-fill text-on-chile',
  ghost: 'bg-transparent text-ink shadow-none! border-transparent! underline decoration-2 underline-offset-4',
};
const SIZE: Record<Size, string> = {
  sm: 'min-h-11 px-3 text-sm',
  md: 'min-h-12 px-5 text-base',
  lg: 'min-h-14 px-6 text-lg',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: Size = 'md', extra?: string): string {
  return cx(
    'press shadow-hard inline-flex select-none items-center justify-center gap-2 rounded-md border-[length:var(--line)] border-outline font-display uppercase tracking-wide no-underline',
    'disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55',
    VARIANT[variant],
    SIZE[size],
    extra,
  );
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
};

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: Size };

export function LinkButton({ variant = 'primary', size = 'md', className, ...rest }: LinkButtonProps) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx('h-5 w-5 animate-spin motion-reduce:animate-none', className)} aria-hidden>
      <path d="M12 3a9 9 0 1 1-9 9" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
