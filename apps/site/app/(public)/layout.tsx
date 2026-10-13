import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BottomBar } from '@/components/layout/BottomBar';
import { StatusBanner } from '@/components/layout/StatusBanner';
import { PageViewBeacon } from '@/components/layout/PageViewBeacon';
import { getSettings, getWeeklyHours, orderingState, todaysHours } from '@/lib/status';

// Status changes must show immediately; every public page reads it fresh.
export const dynamic = 'force-dynamic';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [settings, hours] = await Promise.all([getSettings(), getWeeklyHours()]);
  const ordering = await orderingState(settings);
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 bg-marigold px-4 py-3 font-bold text-on-marigold focus:not-sr-only focus:absolute focus:left-2 focus:top-2"
      >
        Skip to content
      </a>
      <StatusBanner settings={settings} today={todaysHours(hours)} ordering={ordering} />
      <Header />
      <main id="main" className="relative z-10">
        {children}
      </main>
      <Footer settings={settings} />
      <BottomBar canOrder={ordering.canOrder} />
      <PageViewBeacon />
    </>
  );
}
