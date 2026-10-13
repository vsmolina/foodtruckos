import type { Metadata } from 'next';
import Link from 'next/link';
import { CartView } from '@/components/merch/CartView';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { shippingCents } from '@/lib/merch/catalog';

export const metadata: Metadata = { title: 'Merch cart', robots: { index: false } };

export default function MerchCartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <Link
        href="/merch"
        className="inline-flex min-h-11 items-center font-bold underline decoration-2 underline-offset-4"
      >
        ← Keep shopping
      </Link>
      <SectionHeading as="h1" size="h1" kicker="Tu carrito" underline="marigold" className="mt-4">
        Cart
      </SectionHeading>
      <CartView shippingCents={shippingCents()} />
    </div>
  );
}
