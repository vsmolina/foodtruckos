import { getSalesByHour, getTicketTimeTrend, getTopItems } from '@/lib/db/queries/reports';
import { SalesByHourChart } from '@/components/reports/SalesByHourChart';
import { TopItemsChart } from '@/components/reports/TopItemsChart';
import { TicketTimeChart } from '@/components/reports/TicketTimeChart';
import { hourLabel } from '@/components/reports/chart-theme';
import { duration, money } from '@/lib/format';

export const dynamic = 'force-dynamic';

function ChartCard({
  title,
  subtitle,
  empty,
  chart,
  table,
}: {
  title: string;
  subtitle: string;
  /** Message shown instead of the chart when there's no data. */
  empty: string | null;
  chart: React.ReactNode;
  table: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--rule)] bg-bg-raised p-4">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <p className="text-xs text-ink-3">{subtitle}</p>
      {empty ? (
        <div className="py-12 text-center text-sm text-ink-3">{empty}</div>
      ) : (
        <>
          <div className="mt-3">{chart}</div>
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-xs text-ink-3 hover:text-ink-2">Show data</summary>
            <div className="mt-2 max-h-72 overflow-auto">{table}</div>
          </details>
        </>
      )}
    </section>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }): React.JSX.Element {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[var(--rule)] text-left text-xs uppercase tracking-wide text-ink-3">
          {head.map((h, i) => (
            <th key={h} className={`py-1.5 font-medium ${i > 0 ? 'text-right' : ''}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={String(r[0])} className="border-b border-[var(--rule)] last:border-0">
            {r.map((c, i) => (
              <td key={i} className={`py-1.5 ${i > 0 ? 'text-right font-mono tabular-nums' : 'text-ink'}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function ReportsPage(): Promise<React.JSX.Element> {
  const [sales, topItems, ticketTimes] = await Promise.all([
    getSalesByHour(),
    getTopItems(),
    getTicketTimeTrend(),
  ]);
  const hasTicketTimes = ticketTimes.some((d) => d.avgSeconds != null);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl text-ink">Reports</h1>

      <div className="mt-4 flex flex-col gap-6">
        <ChartCard
          title="Sales by hour"
          subtitle="Today vs the average of the previous 7 days (closed days count as $0)"
          empty={sales.length === 0 ? 'No sales today or in the previous 7 days.' : null}
          chart={<SalesByHourChart data={sales} />}
          table={
            <DataTable
              head={['Hour', 'Today', '7-day avg']}
              rows={sales.map((s) => [
                hourLabel(s.hour),
                s.todayCents == null ? '—' : money(s.todayCents),
                money(s.avgCents),
              ])}
            />
          }
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Top items"
            subtitle="By quantity sold, last 7 days"
            empty={topItems.length === 0 ? 'No items sold in the last 7 days.' : null}
            chart={<TopItemsChart data={topItems} />}
            table={<DataTable head={['Item', 'Sold']} rows={topItems.map((t) => [t.name, t.qty])} />}
          />

          <ChartCard
            title="Average ticket time"
            subtitle="Order in to ticket done, per day, last 30 days"
            empty={hasTicketTimes ? null : 'No finished kitchen tickets in the last 30 days.'}
            chart={<TicketTimeChart data={ticketTimes} />}
            table={
              <DataTable
                head={['Day', 'Avg time']}
                rows={ticketTimes.filter((d) => d.avgSeconds != null).map((d) => [d.day, duration(d.avgSeconds)])}
              />
            }
          />
        </div>
      </div>
    </div>
  );
}
