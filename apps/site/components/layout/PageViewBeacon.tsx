'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

// Privacy-light analytics: path + referrer host, sent with sendBeacon. No
// cookies, no IDs, no third-party script.
export function PageViewBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const ref = document.referrer ? new URL(document.referrer).host : '';
      const body = JSON.stringify({ path: pathname, ref: ref === location.host ? '' : ref });
      navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }));
    } catch {
      /* analytics must never break the page */
    }
  }, [pathname]);
  return null;
}
