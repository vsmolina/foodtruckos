'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Sidebar nav item with active-state highlight. `/` matches exactly; every other
// href matches its path prefix (so /orders/123 keeps "Orders" active).
export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-[var(--radius)] px-2 py-1.5 text-sm transition-colors ${
        active ? 'bg-bg-sunken font-medium text-ink' : 'text-ink-2 hover:bg-bg-sunken'
      }`}
    >
      {children}
    </Link>
  );
}
