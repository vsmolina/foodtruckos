'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/lib/cx';

// Mobile thumb bar: the two jobs people come for at 2 AM — order, and find
// the truck — plus the menu. Hidden on lg+ and inside the order flow (which
// has its own cart bar) and the admin.

export function BottomBar({ canOrder }: { canOrder: boolean }) {
  const pathname = usePathname();
  if (pathname.startsWith('/order') || pathname.startsWith('/merch/cart')) return null;

  const items = [
    { href: '/menu', label: 'Menu', icon: MenuIcon },
    { href: '/order', label: canOrder ? 'Order ahead' : 'Order', icon: BagIcon, primary: true },
    { href: '/find-us', label: 'Find us', icon: PinIcon },
  ];

  return (
    <nav
      aria-label="Quick actions"
      className="fixed inset-x-0 bottom-0 z-30 border-t-[length:var(--line)] border-outline bg-bg pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-[1fr_1.3fr_1fr] gap-2 px-3 py-2">
        {items.map(({ href, label, icon: Icon, primary }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={pathname === href ? 'page' : undefined}
              className={cx(
                'press shadow-hard-sm flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border-[length:var(--line-thin)] border-outline px-2 font-display text-sm uppercase no-underline',
                primary ? 'bg-chile text-on-chile' : 'bg-surface text-ink',
              )}
            >
              <Icon />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 shrink-0">
      <path d="M4 3h12v14H4zM7 7h6M7 10h6M7 13h4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}
function BagIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 shrink-0">
      <path d="M3.5 7h13l-1 10h-11zM7 7V5.5a3 3 0 0 1 6 0V7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 shrink-0">
      <path d="M10 18s6-5.5 6-10a6 6 0 0 0-12 0c0 4.5 6 10 6 10z" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="10" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}
