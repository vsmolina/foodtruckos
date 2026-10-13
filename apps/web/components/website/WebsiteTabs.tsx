'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WEBSITE_TABS } from './tabs';

export function WebsiteTabs(): React.JSX.Element {
  const pathname = usePathname();
  return (
    <nav aria-label="Website sections" className="-mx-1 mt-4 overflow-x-auto border-b border-[var(--rule)]">
      <ul className="flex min-w-max gap-1 px-1">
        {WEBSITE_TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={`-mb-px block whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
                  active ? 'border-[var(--accent)] font-medium text-ink' : 'border-transparent text-ink-2 hover:text-ink'
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
