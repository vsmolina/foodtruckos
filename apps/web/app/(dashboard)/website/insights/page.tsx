import Link from 'next/link';
import type { WatchSummary, WebOrderState } from '@barrio/site-contract';
import { clockTime, money } from '@/lib/format';
import { siteData } from '@/lib/site/api';
import { Empty, Panel, Pill } from '@/components/website/ui';
import { BarList, Heatmap } from './Heatmap';
import { OrderControls } from './OrderControls';

export const dynamic = 'force-dynamic';

const RANGES = [7, 30, 90] as const;

const ORDER_PILL: Record<WebOrderState, ['neutral' | 'ok' | 'warn' | 'danger' | 'accent', string]> = {
  pending_payment: ['neutral', 'Unpaid'],
  received: ['accent', 'Received'],
  preparing: ['warn', 'Preparing'],
  ready: ['ok', 'Ready'],
  picked_up: ['neutral', 'Picked up'],
  cancelled: ['danger', 'Cancelled'],
  failed: ['danger', 'Failed'],
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Tile({ label, value, hint }: { label: string; value: string; hint?: string | undefined }): React.JSX.Element {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--rule)] bg-bg-raised p-4">
      <div className="text-sm text-ink-2">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums text-ink">{value}</div>
      {hint ? <div className="mt-1 text-xs text-ink-3">{hint}</div> : null}
    </div>
  );
}

function Watch({ name, w }: { name: string; w: WatchSummary }): React.JSX.Element {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--rule)] p-3">
      <dt className="text-xs uppercase tracking-wide text-ink-3">{name}</dt>
      <dd className="mt-1 text-sm text-ink">
        <span className="text-2xl font-semibold tabular-nums">{w.window}</span> in the window{' '}
        <span className="text-ink-3">vs {w.avgSlot.toFixed(1)} in an average block</span>
        <br />
        <span className="text-ink-2">
          {w.total
            ? `${pct(w.share)} of night-time ${name.toLowerCase()} — ${w.window >= w.avgSlot ? 'at or above' : 'below'} average (${w.avgSlot ? `${Math.round((w.window / w.avgSlot) * 100)}%` : '—'} of a typical block).`
            : 'No data yet.'}
        </span>
      </dd>
    </div>
  );
}

export default async function InsightsPage({ searchParams }: PageProps<'/website/insights'>): Promise<React.JSX.Element> {
  const asked = Number((await searchParams).days);
  const days = (RANGES as readonly number[]).includes(asked) ? (asked as (typeof RANGES)[number]) : 30;
  const [tonight, a] = await Promise.all([siteData('insights.orders', {}), siteData('insights.analytics', { days })]);
  const t = a.totals;

  return (
    <div className="grid gap-6 [&>*]:min-w-0">
      <Panel
        title="Tonight’s web orders"
        description={
          <>
            Last 16 hours: {tonight.paidCount} paid · {money(tonight.paidTotalCents)}. Status moves by itself from the kitchen screen — use these only if
            the KDS link is down{tonight.testMode ? ' (or in test mode)' : ''}.
          </>
        }
      >
        {tonight.orders.length === 0 ? (
          <Empty>No web orders tonight.</Empty>
        ) : (
          <ul className="divide-y divide-[var(--rule)]">
            {tonight.orders.map((o) => {
              const [tone, label] = ORDER_PILL[o.status];
              return (
                <li key={o.id} className="grid gap-2 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-lg font-semibold tracking-wider text-ink">{o.code}</span>
                    <Pill tone={tone}>{label}</Pill>
                    <span className="font-medium text-ink">{o.customerName}</span>
                    <span className="text-sm text-ink-3">···{o.phoneLast4}</span>
                    {o.smsOptIn ? <span className="text-sm text-ink-3">· text on ready{o.readySmsSent ? ' (sent)' : ''}</span> : null}
                    <span className="ml-auto text-sm text-ink-3">{clockTime(o.createdAt)}</span>
                  </div>
                  <p className="text-sm text-ink-2">
                    {o.lines
                      .map(
                        (l) =>
                          `${l.qty}× ${l.itemName}${l.variationName !== 'Regular' ? ` (${l.variationName})` : ''}${l.modifiers.length ? ` — ${l.modifiers.join(', ')}` : ''}`,
                      )
                      .join(' · ')}
                    <span className="font-medium text-ink"> · {money(o.totalCents)}</span>
                  </p>
                  {o.error ? <p className="text-sm text-danger">{o.error}</p> : null}
                  {['received', 'preparing', 'ready'].includes(o.status) ? <OrderControls id={o.id} status={o.status} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl text-ink">Traffic &amp; sales</h2>
        <nav aria-label="Date range" className="flex gap-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/website/insights?days=${r}`}
              aria-current={r === days ? 'page' : undefined}
              className={`rounded-[var(--radius)] border px-3 py-1 text-sm ${
                r === days ? 'border-[var(--accent)] font-medium text-ink' : 'border-[var(--rule)] text-ink-2 hover:bg-bg-sunken'
              }`}
            >
              {r} days
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Page views" value={t.views.toLocaleString('en-US')} hint={`last ${days} days`} />
        <Tile
          label="Web orders"
          value={t.orders.toLocaleString('en-US')}
          hint={t.views && t.orders <= t.views ? `${((t.orders / t.views) * 100).toFixed(1)} per 100 page views` : undefined}
        />
        <Tile label="Web order revenue" value={money(t.revenueCents)} hint={t.orders ? `${money(Math.round(t.revenueCents / t.orders))} average · incl. tax & tips` : 'incl. tax & tips'} />
        <Tile label="Merch revenue" value={money(t.merchCents)} hint={`${t.merchOrders} order${t.merchOrders === 1 ? '' : 's'}`} />
      </div>

      <Panel title="Thursday & Friday, 8–10 PM" description="The early-evening window you wanted to watch, compared with an average 2-night × 2-hour block between 6 PM and 5 AM.">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Watch name="Visits" w={a.watch.visits} />
          <Watch name="Orders" w={a.watch.orders} />
        </dl>
      </Panel>

      <Heatmap title="When people visit" cells={a.visitHeat} unit="Page views" />
      <Heatmap title="When people order" cells={a.orderHeat} unit="Paid web orders" />

      <div className="grid gap-6 md:grid-cols-2 [&>*]:min-w-0">
        <Panel title="Top pages">
          <BarList rows={a.topPages} empty="No visits yet." />
        </Panel>
        <Panel title="Top referrers">
          <BarList rows={a.topReferrers} empty="No outside referrers yet (direct visits and QR scans don’t carry one)." />
        </Panel>
      </div>

      <Panel title="Partner referrals" description={`Visits through partner links and QR codes, and the paid web orders they led to (last ${days} days).`}>
        {a.partners.length === 0 ? (
          <Empty>No partners yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-ink-3">
                  <th scope="col" className="py-1.5 pr-3 font-normal">Partner</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-normal">Visits</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-normal">Orders</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-normal">Revenue</th>
                  <th scope="col" className="py-1.5 text-right font-normal">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {a.partners.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--rule)]">
                    <th scope="row" className="py-2 pr-3 font-medium text-ink">
                      {p.name} <span className="font-mono text-xs font-normal text-ink-3">{p.code}</span>
                      {p.active ? null : <span className="ml-1 text-xs font-normal text-ink-3">(inactive)</span>}
                    </th>
                    <td className="py-2 pr-3 text-right tabular-nums text-ink">{p.visits}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-ink">{p.orders}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-ink">{money(p.revenueCents)}</td>
                    <td className="py-2 text-right tabular-nums text-ink">{p.visits ? pct(p.orders / p.visits) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Catering pipeline" description="All time.">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(['new', 'contacted', 'quoted', 'booked', 'declined'] as const).map((s) => (
            <li key={s}>
              <Link href={`/website/catering?stage=${s}`} className="block rounded-[var(--radius)] border border-[var(--rule)] p-3 hover:bg-bg-sunken">
                <span className="block text-xs uppercase tracking-wide text-ink-3">{s}</span>
                <span className="block text-2xl font-semibold tabular-nums text-ink">{a.pipeline[s]}</span>
              </Link>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
