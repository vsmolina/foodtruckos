import Image from 'next/image';
import { PhotoSlot } from '@/components/ui/Slots';
import { Sticker } from '@/components/ui/Sticker';
import { cx } from '@/lib/cx';
import { price } from '@/lib/format';
import type { MenuItem } from '@/lib/menu';

// Menu card: framed photo, name + price on one line, Spanish tagline in the
// hand face, description in the body face. Sold out = struck price + sticker +
// dimmed photo (word, not colour alone). Tilt is fixed by position.
// Literal class names so Tailwind generates them.
const TILT = ['sm:tilt-c', 'sm:tilt-b', '', 'sm:tilt-a'] as const;
const SLOT_TONES = ['marigold', 'rosa', 'agave', 'anil', 'chile'] as const;

export function MenuItemCard({ item, index, action }: { item: MenuItem; index: number; action?: React.ReactNode }) {
  return (
    <article
      className={cx(
        'panel relative grid grid-cols-[6.5rem_1fr] overflow-visible sm:flex sm:flex-col',
        // Compact rows on phones; tilt only on the roomier card layout.
        TILT[index % TILT.length],
        item.soldOut && 'opacity-90',
      )}
      aria-label={`${item.name}${item.soldOut ? ', sold out' : ''}`}
    >
      <div className="relative min-h-28 overflow-hidden rounded-l-[3px] border-r-[length:var(--line)] border-outline sm:aspect-[16/10] sm:min-h-0 sm:rounded-l-none sm:rounded-t-[3px] sm:border-r-0 sm:border-b-[length:var(--line)]">
        {item.photoUrl ? (
          <Image
            src={item.photoUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className={cx('object-cover', item.soldOut && 'grayscale')}
          />
        ) : (
          <PhotoSlot label={item.name} tone={SLOT_TONES[index % SLOT_TONES.length] ?? 'marigold'} className={cx(item.soldOut && 'grayscale')} />
        )}
      </div>
      <div className="absolute -top-3 left-3 flex gap-2">
        {item.isNew ? (
          <Sticker tone="rosa" tilt="e" size="sm">
            ¡Nuevo!
          </Sticker>
        ) : null}
        {item.soldOut ? (
          <Sticker tone="chile" tilt="b" size="sm">
            Sold out · Agotado
          </Sticker>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3 sm:gap-1.5 sm:p-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-display text-lg uppercase leading-tight sm:text-h3">{item.name}</h3>
          <p className={cx('shrink-0 font-display text-lg text-marigold sm:text-h3', item.soldOut && 'text-ink-muted line-through')}>
            {item.variations.length > 1 ? <span className="mr-1 align-middle text-xs font-sans font-bold text-ink-muted no-underline">from</span> : null}
            {price(item.fromCents)}
          </p>
        </div>
        {item.taglineEs ? <p className="font-hand text-lg text-marigold">{item.taglineEs}</p> : null}
        {item.description ? <p className="text-sm text-ink-muted sm:text-base">{item.description}</p> : null}
        {item.variations.length > 1 ? (
          <p className="text-sm font-bold">
            {item.variations.map((v) => `${v.name} ${price(v.priceCents)}`).join(' · ')}
          </p>
        ) : null}
        {action ? <div className="mt-auto pt-3">{action}</div> : null}
      </div>
    </article>
  );
}
