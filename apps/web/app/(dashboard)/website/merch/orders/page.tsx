import Link from 'next/link';
import { Empty, Panel } from '@/components/website/ui';
import { dateTime, money } from '@/lib/format';
import { siteData } from '@/lib/site/api';
import { MerchSubnav, OrderStatusPill } from '../shared';

export const dynamic = 'force-dynamic';

export default async function MerchOrdersPage({ searchParams }: PageProps<'/website/merch/orders'>): Promise<React.JSX.Element> {
  const show = (await searchParams).show === 'all' ? 'all' : 'active';
  const { orders, toShip } = await siteData('merch.listOrders', { show });

  return (
    <div className="grid gap-4">
      <MerchSubnav active="orders" toShip={toShip} />
      <Panel
        title="Orders"
        description={
          <>
            {show === 'all' ? 'All orders, including unpaid and abandoned checkouts.' : 'Paid orders.'}{' '}
            <Link href={show === 'all' ? '/website/merch/orders' : '/website/merch/orders?show=all'} className="text-accent hover:underline">
              {show === 'all' ? 'Paid only' : 'Show all'}
            </Link>
          </>
        }
      >
        {orders.length === 0 ? (
          <Empty>No merch orders yet.</Empty>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-3">
                  <th className="py-1 pr-3 font-normal">Order</th>
                  <th className="py-1 pr-3 font-normal">Items</th>
                  <th className="py-1 pr-3 font-normal">Customer</th>
                  <th className="py-1 pr-3 text-right font-normal">Total</th>
                  <th className="py-1 text-right font-normal">Placed</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-[var(--rule)] align-top">
                    <td className="py-2 pr-3">
                      <Link href={`/website/merch/orders/${o.id}`} className="font-mono font-medium text-ink hover:underline">
                        #{o.ref}
                      </Link>
                      <div className="mt-1">
                        <OrderStatusPill status={o.status} />
                      </div>
                    </td>
                    <td className="max-w-64 py-2 pr-3 text-ink-2">
                      {o.lines.map((l) => `${l.qty}× ${l.productName}${l.variantLabel ? ` (${l.variantLabel})` : ''}`).join(', ')}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="text-ink">{o.name ?? 'No name yet'}</div>
                      <div className={o.delivery === 'pickup' ? 'font-medium text-ink' : 'text-ink-3'}>
                        {o.delivery === 'pickup' ? 'Pickup at the truck' : 'Ship'}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{money(o.totalCents)}</td>
                    <td className="whitespace-nowrap py-2 text-right text-ink-3">{dateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
