'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Re-render the (server) page every 2s while a Square sync is in flight, so the
// badge flips to "In Square" / "Sync failed" without a manual reload. Gives up
// after 2 minutes (retries back off to ~1 min total).
export function RefreshWhilePending({ active }: { active: boolean }): null {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > 120_000) clearInterval(timer);
      else router.refresh();
    }, 2000);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}
