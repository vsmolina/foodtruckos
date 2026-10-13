import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

// Die-cut sticker: flat fill, black outline, small hard shadow, a fixed tilt.
// Tilt is chosen per use (design/DESIGN.md → Tilt map), never randomised.

type Tone = 'marigold' | 'rosa' | 'agave' | 'chile' | 'paper' | 'anil';
type Tilt = 'a' | 'b' | 'c' | 'd' | 'e' | 'none';

const TONE: Record<Tone, string> = {
  marigold: 'bg-marigold text-on-marigold',
  rosa: 'bg-rosa text-on-rosa',
  agave: 'bg-agave text-on-agave',
  chile: 'bg-chile text-on-chile',
  paper: 'bg-paper text-paper-ink',
  anil: 'bg-anil text-on-anil',
};
const TILT: Record<Tilt, string> = {
  a: 'tilt-a',
  b: 'tilt-b',
  c: 'tilt-c',
  d: 'tilt-d',
  e: 'tilt-e',
  none: '',
};

export function Sticker({
  children,
  tone = 'marigold',
  tilt = 'a',
  size = 'md',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  tilt?: Tilt;
  size?: 'sm' | 'md' | 'lg';
  className?: string | undefined;
}) {
  return (
    <span
      className={cx(
        'straighten shadow-hard-sm inline-flex items-center gap-1.5 rounded-sm border-[length:var(--line-thin)] border-outline font-display uppercase leading-none tracking-wide',
        size === 'sm' && 'px-2 py-1 text-xs',
        size === 'md' && 'px-2.5 py-1.5 text-sm',
        size === 'lg' && 'px-3.5 py-2 text-lg',
        TONE[tone],
        TILT[tilt],
        className,
      )}
    >
      {children}
    </span>
  );
}
