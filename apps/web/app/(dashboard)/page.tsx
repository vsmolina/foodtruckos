import Link from 'next/link';
import { getTodaySummary, getRecentOrders } from '@/lib/db/queries/metrics';
import { StatTile } from '@/components/dashboard/StatTile';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { money, duration, orderNumber, clockTime } from '@/lib/format';

// Live numbers are per-request; never cache.
export const dynamic = 'force-dynamic';

export default async function TodayPage(): Promise<React.JSX.Element> {
  const [summary, recent] = await Promise.all([getTodaySummary(), getRecentOrders(10)]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl text-ink">Today</h1>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active tickets" value={String(summary.activeTickets)} hint="in the kitchen now" />
        <StatTile label="Sales" value={money(summary.salesCents)} hint="today" />
        <StatTile label="Orders closed" value={String(summary.ordersClosed)} hint="today" />
        <StatTile label="Avg ticket time" value={duration(summary.avgTicketSeconds)} hint="today" />
      </div>

      <div className="mt-8">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-lg text-ink">Latest orders</h2>
          <Link href="/orders" className="text-sm text-accent hover:underline">
            All orders →
          </Link>
        </div>

        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--rule)]">
          {recent.length === 0 ? (
            <div className="p-6 text-center text-sm text-ink-3">No orders yet.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {recent.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-[var(--rule)] last:border-0 hover:bg-bg-sunken"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/orders/${o.id}`}
                        className="font-mono font-medium text-ink hover:text-accent"
                      >
                        {orderNumber(o.squareOrderId, o.id)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-2.5 text-ink-3">
                      {o.itemCount} {o.itemCount === 1 ? 'item' : 'items'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-ink">
                      {money(o.totalCents)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-ink-3">{clockTime(o.openedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
