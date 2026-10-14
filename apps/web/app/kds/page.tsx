import type { Viewport } from 'next';
import { KdsBoard } from '@/components/kds/KdsBoard';
import { defaultStoreId } from '@/lib/kds/snapshot';

// The KDS is a live board; never cache it.
export const dynamic = 'force-dynamic';

// Fill the Pi screen exactly; no pinch-zoom on the kiosk.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function KdsPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}): Promise<React.JSX.Element> {
  const { store } = await searchParams;
  const storeId = store ?? (await defaultStoreId());

  if (!storeId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg text-ink">
        No store configured. Seed the database first.
      </div>
    );
  }

  return <KdsBoard storeId={storeId} />;
}
