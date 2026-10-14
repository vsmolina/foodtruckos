import { cx } from '@/lib/cx';

/**
 * LOGO SLOT. The owner is drawing the final logo by hand (line-art burger in a
 * sombrero, two chiles, "BARRIO BURGER CO." banner). Until it's delivered this
 * renders a clearly labelled placeholder. To install: put the artwork at
 * public/brand/logo.svg and set NEXT_PUBLIC_LOGO_READY=1.
 */
export function LogoSlot({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const dims = { sm: 'h-10 w-10', md: 'h-14 w-14', lg: 'h-28 w-28', xl: 'h-44 w-44 sm:h-56 sm:w-56' }[size];
  if (process.env.NEXT_PUBLIC_LOGO_READY === '1') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/brand/logo.svg" alt="Barrio Burger Co." className={cx(dims, 'object-contain', className)} />;
  }
  return (
    <span
      role="img"
      aria-label="Barrio Burger Co. logo (placeholder)"
      className={cx(
        dims,
        'grid shrink-0 place-items-center rounded-full border-[length:var(--line-thin)] border-dashed border-current bg-surface-2 p-1 text-center font-display uppercase leading-[0.95] text-ink-muted',
        size === 'sm' ? 'text-[7px]' : size === 'md' ? 'text-[8px]' : 'text-xs sm:text-sm',
        className,
      )}
    >
      Logo
      <br />
      slot
    </span>
  );
}

/** Photo placeholder: a flat colour panel with a label. Real photos replace it. */
export function PhotoSlot({ label, tone = 'surface-2', className }: { label: string; tone?: 'surface-2' | 'marigold' | 'rosa' | 'agave' | 'chile' | 'anil'; className?: string }) {
  const bg = {
    'surface-2': 'bg-surface-2 text-ink-muted',
    marigold: 'bg-marigold text-on-marigold',
    rosa: 'bg-rosa text-on-rosa',
    agave: 'bg-agave text-on-agave',
    chile: 'bg-chile text-on-chile',
    anil: 'bg-anil text-on-anil',
  }[tone];
  return (
    <div className={cx('grid h-full w-full place-items-center p-3 text-center', bg, className)}>
      <span className="font-hand text-base leading-tight opacity-80">
        foto:
        <br />
        {label}
      </span>
    </div>
  );
}
