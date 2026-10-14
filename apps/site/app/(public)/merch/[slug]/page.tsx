import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CartLink } from '@/components/merch/CartLink';
import { ProductPicker } from '@/components/merch/ProductPicker';
import { PhotoSlot } from '@/components/ui/Slots';
import { Sticker } from '@/components/ui/Sticker';
import { getProductBySlug, inStock, variantPrice } from '@/lib/merch/catalog';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  return p
    ? { title: p.name, description: p.description ?? `${p.name} — Barrio Burger Co. merch` }
    : { title: 'Not found' };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();
  const variants = product.variants.map((v) => ({
    id: v.id,
    size: v.size,
    color: v.color,
    priceCents: variantPrice(product, v),
    inStock: inStock(v),
    lowStock: v.stock,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/merch"
          className="inline-flex min-h-11 items-center font-bold underline decoration-2 underline-offset-4"
        >
          ← All merch
        </Link>
        <CartLink />
      </div>
      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div className="paper tilt-c relative aspect-square overflow-hidden p-0">
          {product.photoUrl ? (
            <Image
              src={product.photoUrl}
              alt={product.name}
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <PhotoSlot label={product.name} tone="rosa" />
          )}
          {product.soldOut ? (
            <Sticker tone="chile" tilt="e" size="lg" className="absolute left-4 top-4">
              Agotado · Sold out
            </Sticker>
          ) : null}
        </div>
        <div className="flex flex-col gap-5">
          <div>
            <p className="font-hand text-lg text-marigold tilt-c">Hecho en el barrio</p>
            <h1 className="font-display text-h1 uppercase">{product.name}</h1>
          </div>
          {product.description ? <p className="text-lg">{product.description}</p> : null}
          <ProductPicker slug={product.slug} name={product.name} variants={variants} />
          <p className="text-sm text-ink-muted">
            Ships in the US (flat rate) or pick up free at the truck. Sales tax is added at
            checkout.
          </p>
        </div>
      </div>
    </div>
  );
}
