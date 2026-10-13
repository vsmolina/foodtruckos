import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Underline } from './Doodles';

/**
 * Two-line heading: a Spanish hand-lettered kicker (decorative, not needed to
 * understand the page) over a clear English display heading with a hand-drawn
 * underline that draws itself in.
 */
export function SectionHeading({
  kicker,
  children,
  as: Tag = 'h2',
  size = 'h2',
  align = 'left',
  underline = 'marigold',
  className,
  id,
}: {
  kicker?: ReactNode;
  children: ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  size?: 'hero' | 'h1' | 'h2' | 'h3';
  align?: 'left' | 'center';
  underline?: 'marigold' | 'rosa' | 'agave' | 'chile' | false;
  className?: string;
  id?: string;
}) {
  const color = { marigold: 'text-marigold', rosa: 'text-rosa', agave: 'text-agave', chile: 'text-chile' };
  return (
    <div className={cx('flex flex-col gap-1', align === 'center' && 'items-center text-center', className)}>
      {kicker ? <p className="font-hand text-lg text-marigold tilt-c">{kicker}</p> : null}
      <Tag
        id={id}
        className={cx(
          'relative inline-block font-display uppercase text-ink',
          { hero: 'text-hero', h1: 'text-h1', h2: 'text-h2', h3: 'text-h3' }[size],
        )}
      >
        {children}
        {underline ? (
          <Underline className={cx('draw absolute -bottom-2 left-0 h-3 w-full', color[underline])} />
        ) : null}
      </Tag>
    </div>
  );
}
