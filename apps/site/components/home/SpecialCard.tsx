import Image from 'next/image';
import { Burst } from '@/components/ui/Doodles';
import { Sticker } from '@/components/ui/Sticker';
import { cx } from '@/lib/cx';
import type { Special } from '@/lib/menu';

// Flyer-style special: taped paper card, kicker sticker, price in a burst.
// Tilt alternates by position (a, d, c) — fixed, not random.
const TILTS = ['tilt-a', 'tilt-d', 'tilt-c'] as const;
const STICKERS = ['rosa', 'marigold', 'agave'] as const;

export function SpecialCard({ special, index }: { special: Special; index: number }) {
  return (
    <article className={cx('paper taped relative flex flex-col gap-3 p-5 pt-6', TILTS[index % 3])}>
      {special.kicker ? (
        <Sticker tone={STICKERS[index % 3] ?? 'marigold'} tilt="e" className="absolute -left-2 -top-4">
          {special.kicker}
        </Sticker>
      ) : null}
      {special.photoUrl ? (
        <div className="relative -mx-1 aspect-[4/3] overflow-hidden border-[length:var(--line-thin)] border-outline">
          <Image src={special.photoUrl} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
        </div>
      ) : null}
      <h3 className="pr-16 font-display text-h3 uppercase">{special.title}</h3>
      {special.body ? <p className="text-base leading-snug">{special.body}</p> : null}
      {special.priceLabel ? (
        <Burst className="absolute -right-2 -top-7 h-24 w-24 text-marigold">
          <span className="font-display text-base text-on-marigold">{special.priceLabel}</span>
        </Burst>
      ) : null}
    </article>
  );
}
