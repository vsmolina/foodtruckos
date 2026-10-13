import Link from 'next/link';
import type { MerchOrderStatus } from '@barrio/site-contract';
import { Pill } from '@/components/website/ui';

// Bits shared by the merch pages.

export const ORDER_STATUS: Record<MerchOrderStatus, { label: string; tone: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent' }> = {
  pending: { label: 'Awaiting payment', tone: 'neutral' },
  paid: { label: 'To ship', tone: 'warn' },
  fulfilled: { label: 'Fulfilled', tone: 'ok' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  refunded: { label: 'Refunded', tone: 'accent' },
};

export function OrderStatusPill({ status }: { status: MerchOrderStatus }): React.JSX.Element {
  const s = ORDER_STATUS[status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

/** Products | Orders switch inside the Merch tab. */
export function MerchSubnav({ active, toShip }: { active: 'products' | 'orders'; toShip: number }): React.JSX.Element {
  const item = (href: string, key: 'products' | 'orders', label: React.ReactNode) => (
    <Link
      href={href}
      aria-current={active === key ? 'page' : undefined}
      className={`inline-flex items-center gap-2 rounded-[var(--radius)] px-3 py-1.5 text-sm ${
        active === key ? 'bg-bg-sunken font-medium text-ink' : 'text-ink-2 hover:bg-bg-sunken hover:text-ink'
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex flex-wrap gap-1">
      {item('/website/merch', 'products', 'Products')}
      {item(
        '/website/merch/orders',
        'orders',
        <>
          Orders
          {toShip ? <Pill tone="warn">{toShip} to ship</Pill> : null}
        </>,
      )}
    </div>
  );
}

const NOTICES = {
  created: { tone: 'ok', text: 'Product created. It’s on the website if it’s marked live.' },
  saved: { tone: 'ok', text: 'Saved. The website is updated.' },
  deleted: { tone: 'ok', text: 'Product deleted.' },
  err_delete: { tone: 'error', text: 'Couldn’t delete that product. Try again.' },
} as const;

export function merchNotice(code: string | string[] | undefined): { tone: 'ok' | 'error'; text: string } | null {
  const c = Array.isArray(code) ? code[0] : code;
  return c && c in NOTICES ? NOTICES[c as keyof typeof NOTICES] : null;
}

/** Product / variant thumbnail; a quiet placeholder when there's no photo. */
export function Thumb({ src, size = 'size-14' }: { src: string | null; size?: string }): React.JSX.Element {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- remote site image, any host
    <img src={src} alt="" className={`${size} shrink-0 rounded-[var(--radius)] border border-[var(--rule)] object-cover`} />
  ) : (
    <div
      aria-hidden
      className={`${size} grid shrink-0 place-items-center rounded-[var(--radius)] border border-dashed border-[var(--rule)] text-[10px] text-ink-3`}
    >
      no photo
    </div>
  );
}
