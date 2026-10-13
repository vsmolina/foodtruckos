import Link from 'next/link';
import { desc, inArray } from 'drizzle-orm';
import { MerchTabs } from '@/components/admin/merch/MerchTabs';
import { STATUS_LABEL, STATUS_TONE } from '@/components/admin/merch/status';
import { AdminPage, Empty, Pill } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { merchOrders } from '@/lib/db/schema';
import { cx } from '@/lib/cx';
import { dateTime, money } from '@/lib/format';

type Props = { searchParams: Promise<{ show?: string }> };

export default async function AdminMerchOrdersPage({ searchParams }: Props) {
  await requireAdmin();
  const show = (await searchParams).show === 'all' ? 'all' : 'active';
  const orders = await db
    .select()
    .from(merchOrders)
    .where(show === 'all' ? undefined : inArray(merchOrders.status, ['paid', 'fulfilled']))
    .orderBy(desc(merchOrders.createdAt))
    .limit(200);
  const toShip = orders.filter((o) => o.status === 'paid').length;

  return (
    <AdminPage title="Merch">
      <MerchTabs active="orders" toShip={toShip} />
      <p className="text-sm">
        Showing {show === 'all' ? 'all orders (incl. unpaid / abandoned)' : 'paid orders'} ·{' '}
        <Link
          href={show === 'all' ? '/admin/merch/orders' : '/admin/merch/orders?show=all'}
          className="font-bold underline"
        >
          {show === 'all' ? 'Paid only' : 'Show all'}
        </Link>
      </p>
      {orders.length === 0 ? (
        <Empty>No merch orders yet.</Empty>
      ) : (
        <ul className="rounded-md border-2 border-outline bg-surface px-4">
          {orders.map((o) => (
            <li
              key={o.id}
              className="flex flex-col gap-1 border-b-2 border-surface-2 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex items-center gap-2 sm:w-48">
                <Link
                  href={`/admin/merch/orders/${o.id}`}
                  className="font-mono font-bold underline"
                >
                  #{o.id.slice(-6).toUpperCase()}
                </Link>
                <Pill tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Pill>
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate">
                  {o.lines
                    .map(
                      (l) =>
                        `${l.qty}× ${l.productName}${l.variantLabel ? ` ${l.variantLabel}` : ''}`,
                    )
                    .join(', ')}
                </p>
                <p className="text-ink-muted">
                  {o.name ?? 'No name yet'} ·{' '}
                  <span className={cx(o.delivery === 'pickup' && 'font-bold text-ink')}>
                    {o.delivery === 'pickup' ? 'Pickup at truck' : 'Ship'}
                  </span>
                </p>
              </div>
              <div className="flex justify-between gap-4 text-sm sm:block sm:text-right">
                <p className="font-bold tabular-nums">{money(o.totalCents)}</p>
                <p className="text-ink-muted">{dateTime(o.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminPage>
  );
}
