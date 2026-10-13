import Link from 'next/link';
import { businessTimezone, getTodaySummary, getRecentOrders } from '@/lib/db/queries/metrics';
import { getSalesByHour } from '@/lib/db/queries/reports';
import { StatTile } from '@/components/dashboard/StatTile';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { TicketTime } from '@/components/dashboard/TicketTime';
import { SalesByHourChart } from '@/components/reports/SalesByHourChart';
import { compare } from '@/lib/compare';
import { tierFor, TIER_WORD } from '@/lib/kds/tiers';
import { money, duration, orderNumber, clockTime } from '@/lib/format';

// Live numbers are per-request; never cache.
export const dynamic = 'force-dynamic';

// Today answers "how is today going?" at a glance: each number is compared with
// the same weekday last week *up to this time of day* (a like-for-like check),
// the kitchen's state uses the KDS lateness tiers, and the list shows what was
// actually ordered and how long the kitchen took.
export default async function TodayPage(): Promise<React.JSX.Element> {
  const [summary, recent, sales, tz] = await Promise.all([
    getTodaySummary(),
    getRecentOrders(12),
    getSalesByHour(),
    businessTimezone(),
  ]);
  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'short', timeZone: tz });
  const lastWeekLabel = `last ${weekday}`;
  const lw = summary.lastWeek;

  const oldestMs = summary.oldestActiveStartedAt
    ? now.getTime() - new Date(summary.oldestActiveStartedAt).getTime()
    : null;
  const oldestTier = oldestMs == null ? 'normal' : tierFor(oldestMs);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-3xl text-ink">Today</h1>
        <p className="text-sm text-ink-3">
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz })} ·
          compared with {lastWeekLabel} up to {clockTime(now.toISOString(), tz)}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          hero
          label="Sales"
          value={money(summary.salesCents)}
          delta={compare(summary.salesCents, lw.salesCents, lastWeekLabel, true)}
        />
        <StatTile
          label="Orders"
          value={String(summary.orders)}
          delta={compare(summary.orders, lw.orders, lastWeekLabel, true)}
          hint={summary.orders ? `${money(Math.round(summary.salesCents / summary.orders))} average order` : undefined}
        />
        <StatTile
          label="Avg ticket time"
          value={duration(summary.avgTicketSeconds)}
          delta={compare(summary.avgTicketSeconds, lw.avgTicketSeconds, lastWeekLabel, false)}
          hint="order in → ticket done"
        />
        <StatTile
          label="In the kitchen now"
          value={String(summary.activeTickets)}
          hint={
            oldestMs == null ? (
              'board is clear'
            ) : (
              <span className="inline-flex items-center gap-2">
                oldest waiting {duration(oldestMs / 1000)}
                {TIER_WORD[oldestTier] ? (
                  <span
                    className="rounded-[var(--radius-sm)] px-1.5 text-[11px] font-bold uppercase leading-[1.6] tracking-wide"
                    style={
                      oldestTier === 'danger'
                        ? { background: 'var(--status-red)', color: '#fff' }
                        : { background: 'var(--status-amber)', color: '#1a1206' }
                    }
                  >
                    {TIER_WORD[oldestTier]}
                  </span>
                ) : null}
              </span>
            )
          }
        />
      </div>

      <section className="mt-6 rounded-[var(--radius-lg)] border border-[var(--rule)] bg-bg-raised p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl text-ink">Sales by hour</h2>
          <Link href="/reports" className="text-sm font-medium text-accent hover:underline">
            Reports →
          </Link>
        </div>
        {sales.length === 0 ? (
          <div className="py-10 text-center text-ink-3">No sales today or in the previous 7 days.</div>
        ) : (
          <div className="mt-3">
            <SalesByHourChart data={sales} height={220} />
          </div>
        )}
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-xl text-ink">Latest orders</h2>
          <Link href="/orders" className="text-sm font-medium text-accent hover:underline">
            All orders →
          </Link>
        </div>

        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--rule)] bg-bg-raised">
          {recent.length === 0 ? (
            <div className="p-6 text-center text-ink-3">No orders yet.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--rule)] text-left text-sm text-ink-3">
                  <th className="w-px px-4 py-2 font-medium">Order</th>
                  <th className="px-4 py-2 font-medium">What</th>
                  <th className="w-px whitespace-nowrap px-4 py-2 text-right font-medium">Kitchen</th>
                  <th className="w-px whitespace-nowrap px-4 py-2 text-right font-medium">Total</th>
                  <th className="w-px whitespace-nowrap px-4 py-2 text-right font-medium">In at</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id} className="border-b border-[var(--rule)] last:border-0 hover:bg-bg-sunken">
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Link href={`/orders/${o.id}`} className="font-mono font-semibold text-ink hover:text-accent">
                        {orderNumber(o.squareOrderId, o.id)}
                      </Link>
                      {o.status !== 'fulfilled' ? (
                        <span className="ml-2">
                          <StatusBadge status={o.status} />
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-0 truncate px-4 py-2.5 text-ink-2" title={o.itemSummary}>
                      {o.itemSummary}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <TicketTime
                        seconds={o.ticketSeconds}
                        cooking={o.ticketState === 'pending' || o.ticketState === 'in_progress'}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono tabular-nums text-ink">
                      {money(o.totalCents)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-ink-3">{clockTime(o.openedAt, tz)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
