'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/lib/cx';
import { ADMIN_NAV } from './nav';

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-1.5 pb-1">
        {ADMIN_NAV.map((n) => {
          const active = n.href === '/admin' ? pathname === '/admin' : pathname.startsWith(n.href);
          return (
            <li key={n.href} className="shrink-0">
              <Link
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'inline-flex min-h-11 items-center rounded-sm border-2 border-outline px-3 text-sm font-bold no-underline',
                  active ? 'bg-marigold text-on-marigold' : 'bg-surface text-ink hover:bg-surface-2',
                )}
              >
                {n.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
