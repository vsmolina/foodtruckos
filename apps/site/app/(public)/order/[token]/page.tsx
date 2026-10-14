import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { publicOrderByToken } from '@/lib/orders/public';
import { getSettings } from '@/lib/status';
import { OrderTracker } from './OrderTracker';

export const metadata: Metadata = { title: 'Your order', robots: { index: false, follow: false } };

export default async function OrderStatusPage({ params }: PageProps<'/order/[token]'>) {
  const { token } = await params;
  const [order, settings] = await Promise.all([publicOrderByToken(token), getSettings()]);
  if (!order) notFound();
  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-8">
      <OrderTracker token={token} initial={order} location={{ name: settings.locationName, address: settings.address }} />
    </div>
  );
}
