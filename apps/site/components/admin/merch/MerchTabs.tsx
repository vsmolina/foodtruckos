import Link from 'next/link';
import { cx } from '@/lib/cx';

export function MerchTabs({ active, toShip }: { active: 'products' | 'orders'; toShip?: number }) {
  const tab = (href: string, key: 'products' | 'orders', label: React.ReactNode) => (
    <Link
      href={href}
      aria-current={active === key ? 'page' : undefined}
      className={cx(
        'inline-flex min-h-11 items-center gap-2 rounded-sm border-2 border-outline px-4 font-bold no-underline',
        active === key ? 'bg-ink text-bg' : 'bg-surface',
      )}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex gap-2">
      {tab('/admin/merch', 'products', 'Products')}
      {tab(
        '/admin/merch/orders',
        'orders',
        <>
          Orders
          {toShip ? (
            <span className="rounded-full bg-chile px-1.5 text-xs text-on-chile">
              {toShip} to ship
            </span>
          ) : null}
        </>,
      )}
    </div>
  );
}
