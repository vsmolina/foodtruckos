import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { SMS_CONSENT_TEXT } from '@/lib/orders/cart';
import { orderingState } from '@/lib/status';
import { CheckoutForm } from './CheckoutForm';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default async function CheckoutPage() {
  const state = await orderingState();
  if (!state.canOrder) redirect('/order');
  const env = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
  return (
    <div className="mx-auto max-w-xl px-4 pb-24 pt-8">
      <SectionHeading as="h1" size="h1" kicker="Ya casi" underline="rosa">
        Checkout
      </SectionHeading>
      <CheckoutForm
        square={{
          appId: process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID ?? '',
          locationId: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ?? '',
          env,
        }}
        consentText={SMS_CONSENT_TEXT}
      />
    </div>
  );
}
