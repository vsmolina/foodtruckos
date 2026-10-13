'use client';

import Link from 'next/link';
import { buttonClass } from '@/components/ui/Button';
import { useMerchCart } from './cart-store';

export function CartLink() {
  const lines = useMerchCart();
  const count = lines.reduce((n, l) => n + l.qty, 0);
  return (
    <Link href="/merch/cart" className={buttonClass('paper', 'sm')}>
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
        <path
          d="M3.5 7h13l-1 10h-11zM7 7V5.5a3 3 0 0 1 6 0V7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      </svg>
      Cart
      {count > 0 ? (
        <span
          className="rounded-full bg-chile px-1.5 text-xs text-on-chile"
          aria-label={`${count} items`}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
