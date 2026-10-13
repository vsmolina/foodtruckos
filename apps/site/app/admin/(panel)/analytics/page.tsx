import Link from 'next/link';
import { BarList } from '@/components/admin/analytics/BarList';
import { Heatmap, watchSummary } from '@/components/admin/analytics/Heatmap';
import { AdminPage, Card, Stat } from '@/components/admin/ui';
import {
  cateringPipeline,
  LEAD_STATUSES,
  orderHeat,
  referralPerformance,
  sinceDaysAgo,
  topPages,
  topReferrers,
  totals,
  visitHeat,
} from '@/lib/analytics';
import { requireAdmin } from '@/lib/auth';
import { cx } from '@/lib/cx';
import { money } from '@/lib/format';

const RANGES = [7, 30, 90] as const;
type Props = { searchParams: Promise<{ days?: string }> };

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default async function AnalyticsPage({ searchParams }: Props) {
  await requireAdmin();
  const asked = Number((await searchParams).days);
  const days = (RANGES as readonly number[]).includes(asked) ? asked : 30;
  const since = sinceDaysAgo(days);

  const [t, vHeat, oHeat, pages, refs, partners, pipeline] = await Promise.all([
    totals(since),
    visitHeat(since),
    orderHeat(since),
    topPages(since),
    topReferrers(since),
    referralPerformance(since),
    cateringPipeline(),
  ]);
  const vWatch = watchSummary(vHeat);
  const oWatch = watchSummary(oHeat);

  return (
    <AdminPage
      title="Analytics"
      actions={
        <nav aria-label="Date range" className="flex gap-1.5">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/analytics?days=${r}`}
              aria-current={r === days ? 'page' : undefined}
              className={cx(
                'inline-flex min-h-11 items-center rounded-sm border-2 border-outline px-3 text-sm font-bold no-underline',
                r === days ? 'bg-ink text-bg' : 'bg-surface',
              )}
            >
              {r} days
            </Link>
          ))}
        </nav>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Page views"
          value={t.views.toLocaleString('en-US')}
          hint={`last ${days} days`}
        />
        <Stat
          label="Web orders"
          value={t.orders.toLocaleString('en-US')}
          hint={
            t.views && t.orders <= t.views
              ? `${((t.orders / t.views) * 100).toFixed(1)} per 100 page views`
              : undefined
          }
        />
        <Stat label="Web order revenue" value={money(t.revenueCents)} hint="incl. tax & tips" />
        <Stat
          label="Avg web order"
          value={t.orders ? money(Math.round(t.revenueCents / t.orders)) : '—'}
          hint={`Merch: ${money(t.merchCents)} (${t.merchOrders} orders)`}
        />
      </div>

      <Card title="Thursday & Friday, 8–10 PM">
        <p className="mb-2 text-sm text-ink-muted">
          The early-evening window you wanted to watch (dashed pink outline in the tables below),
          compared with an average 2-night × 2-hour block between 6 PM and 5 AM.
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['Visits', vWatch],
              ['Orders', oWatch],
            ] as const
          ).map(([name, w]) => (
            <div key={name} className="rounded-md border-2 border-surface-2 p-3">
              <dt className="text-sm font-bold text-ink-muted">{name}</dt>
              <dd className="mt-1">
                <span className="text-2xl font-bold tabular-nums">{w.window}</span> in the window{' '}
                <span className="text-ink-muted">
                  vs {w.avgSlot.toFixed(1)} in an average block
                </span>
                <br />
                <span className="text-sm">
                  {w.total
                    ? `${pct(w.share)} of night-time ${name.toLowerCase()} — ${w.window >= w.avgSlot ? 'at or above' : 'below'} average (${w.avgSlot ? `${Math.round((w.window / w.avgSlot) * 100)}%` : '—'} of a typical block).`
                    : 'No data yet.'}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Heatmap caption="When people visit" cells={vHeat} unit="Page views" />
      <Heatmap caption="When people order" cells={oHeat} unit="Paid web orders" />

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Top pages">
          <BarList rows={pages} empty="No visits yet." />
        </Card>
        <Card title="Top referrers">
          <BarList
            rows={refs}
            empty="No outside referrers yet (direct visits and QR scans don’t carry one)."
          />
        </Card>
      </div>

      <Card title="Partner referrals">
        {partners.length === 0 ? (
          <p className="text-sm text-ink-muted">No partners yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b-2 border-surface-2 text-ink-muted">
                  <th scope="col" className="py-2 pr-3">
                    Partner
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right">
                    Visits
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right">
                    Orders
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right">
                    Revenue
                  </th>
                  <th scope="col" className="py-2 text-right">
                    Conversion
                  </th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id} className="border-b-2 border-surface-2 last:border-0">
                    <th scope="row" className="py-2 pr-3 font-bold">
                      {p.name}{' '}
                      <span className="font-mono text-xs font-normal text-ink-muted">{p.code}</span>
                      {p.active ? null : (
                        <span className="ml-1 text-xs font-normal text-ink-muted">(inactive)</span>
                      )}
                    </th>
                    <td className="py-2 pr-3 text-right tabular-nums">{p.visits}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{p.orders}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{money(p.revenueCents)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {p.visits ? pct(p.orders / p.visits) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Catering pipeline (all time)">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {LEAD_STATUSES.map((s) => (
            <li key={s} className="rounded-md border-2 border-surface-2 p-3">
              <Link href={`/admin/catering?status=${s}`} className="block no-underline">
                <span className="block text-sm font-bold capitalize text-ink-muted">{s}</span>
                <span className="block text-2xl font-bold tabular-nums">{pipeline[s]}</span>
              </Link>
            </li>
          ))}
        </ol>
      </Card>
    </AdminPage>
  );
}
