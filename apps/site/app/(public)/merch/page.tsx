import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CartLink } from '@/components/merch/CartLink';
import { Burst } from '@/components/ui/Doodles';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { PhotoSlot } from '@/components/ui/Slots';
import { Sticker } from '@/components/ui/Sticker';
import { cx } from '@/lib/cx';
import { price } from '@/lib/format';
import { listProducts } from '@/lib/merch/catalog';

export const metadata: Metadata = {
  title: 'Merch',
  description:
    'Barrio Burger Co. tees, hats and stickers. Ship anywhere in the US or pick up at the truck.',
};

// Fixed per-position tilts and photo tones — designed, not random.
const TILTS = ['tilt-c', 'tilt-b', 'tilt-a', 'tilt-d'] as const;
const TONES = ['rosa', 'marigold', 'agave', 'anil'] as const;

export default async function MerchPage() {
  const products = await listProducts();
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading as="h1" size="h1" kicker="La mercancía" underline="rosa">
          Merch
        </SectionHeading>
        <CartLink />
      </div>
      <p className="mt-6 max-w-2xl text-lg text-ink-muted">
        Rep the barrio. Ships anywhere in the US, or pick it up free at the truck window.
      </p>

      {products.length === 0 ? (
        <p className="paper mt-10 p-6 text-lg">New drop coming soon. ¡Pendientes!</p>
      ) : (
        <ul className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p, i) => (
            <li key={p.id}>
              <Link
                href={`/merch/${p.slug}`}
                className={cx(
                  'paper press straighten relative flex h-full flex-col gap-3 p-4 no-underline',
                  TILTS[i % 4],
                )}
              >
                <div className="relative aspect-square overflow-hidden border-[length:var(--line-thin)] border-outline">
                  {p.photoUrl ? (
                    <Image
                      src={p.photoUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <PhotoSlot label={p.name} tone={TONES[i % 4] ?? 'marigold'} />
                  )}
                  {p.soldOut ? (
                    <Sticker tone="chile" tilt="e" size="lg" className="absolute left-3 top-3">
                      Agotado · Sold out
                    </Sticker>
                  ) : null}
                </div>
                <div className="flex items-start justify-between gap-3 pr-2">
                  <div>
                    <h2 className="font-display text-h3 uppercase">{p.name}</h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      {p.variants.length > 1 ? `${p.variants.length} options` : 'One size'}
                    </p>
                  </div>
                </div>
                <Burst
                  className={cx(
                    'absolute -right-3 -top-5 h-20 w-20',
                    p.soldOut ? 'text-surface-2' : 'text-marigold',
                  )}
                >
                  <span
                    className={cx(
                      'font-display text-base',
                      p.soldOut ? 'text-ink line-through' : 'text-on-marigold',
                    )}
                  >
                    {p.variants.some((v) => (v.priceCents ?? p.priceCents) !== p.fromCents)
                      ? `${price(p.fromCents)}+`
                      : price(p.fromCents)}
                  </span>
                </Burst>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
