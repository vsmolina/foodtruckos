import Link from 'next/link';
import { desc, sql } from 'drizzle-orm';
import { AdminPage, Card, Empty, Pill, Stat } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { webOrders } from '@/lib/db/schema';
import { clockTime, money, TIMEZONE } from '@/lib/format';
import { getSettings } from '@/lib/status';

export const dynamic = 'force-dynamic';

const STATUS_PILL = {
  open: { tone: 'green', label: 'Open now' },
  closed: { tone: 'red', label: 'Closed' },
  back_soon: { tone: 'amber', label: 'Back soon' },
} as const;

const ORDER_PILL = {
  pending_payment: ['grey', 'Unpaid'],
  received: ['blue', 'Received'],
  preparing: ['amber', 'Preparing'],
  ready: ['green', 'Ready'],
  picked_up: ['grey', 'Picked up'],
  cancelled: ['grey', 'Cancelled'],
  failed: ['red', 'Failed'],
} as const;

export default async function AdminTodayPage() {
  await requireAdmin();
  const settings = await getSettings();
  // "Tonight" = since 5 AM local (a night runs 5 AM → 5 AM).
  const [counts] = await db.execute<{
    orders: number;
    revenue: number;
    leads: number;
    photos: number;
    takedowns: number;
    to_ship: number;
  }>(sql`
    with night as (
      select ((date_trunc('day', (now() at time zone ${TIMEZONE}) - interval '5 hours') + interval '5 hours') at time zone ${TIMEZONE}) as start
    )
    select
      (select count(*)::int from web_orders, night where created_at >= night.start and status in ('received','preparing','ready','picked_up')) as orders,
      (select coalesce(sum(total_cents),0)::int from web_orders, night where created_at >= night.start and status in ('received','preparing','ready','picked_up')) as revenue,
      (select count(*)::int from catering_leads where status in ('new','contacted','quoted')) as leads,
      (select count(*)::int from gallery_photos where status = 'pending') as photos,
      (select count(*)::int from takedown_requests where status = 'open') as takedowns,
      (select count(*)::int from merch_orders where status = 'paid') as to_ship`);
  const latest = await db.select().from(webOrders).orderBy(desc(webOrders.createdAt)).limit(5);
  const s = STATUS_PILL[settings.status];
  const c = counts ?? { orders: 0, revenue: 0, leads: 0, photos: 0, takedowns: 0, to_ship: 0 };

  return (
    <AdminPage title="Today">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={s.tone}>{s.label}</Pill>
            {settings.status === 'open' && settings.orderingPaused ? (
              <Pill tone="red">Online orders paused</Pill>
            ) : null}
            <span className="text-sm text-ink-muted">
              {settings.status === 'open'
                ? settings.orderingPaused
                  ? (settings.pausedMessage ?? '')
                  : ''
                : (settings.statusMessage ?? '')}
            </span>
          </div>
          <Link
            href="/admin/status"
            className="inline-flex min-h-11 items-center rounded-sm border-2 border-outline bg-marigold px-4 font-bold text-on-marigold no-underline"
          >
            Change status
          </Link>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Web orders tonight" value={c.orders} hint={money(c.revenue)} />
        <Link href="/admin/catering" className="no-underline">
          <Stat label="Open catering leads" value={c.leads} hint="new, contacted or quoted" />
        </Link>
        <Link href="/admin/gallery" className="no-underline">
          <Stat
            label="Photos to review"
            value={c.photos}
            hint={
              c.takedowns
                ? `${c.takedowns} takedown request${c.takedowns === 1 ? '' : 's'} open`
                : 'no takedown requests'
            }
          />
        </Link>
        <Link href="/admin/merch/orders" className="no-underline">
          <Stat label="Merch to ship" value={c.to_ship} />
        </Link>
      </div>

      {c.takedowns ? (
        <p className="rounded-md border-2 border-outline bg-danger-fill p-3 font-bold text-on-chile">
          {c.takedowns} photo takedown request{c.takedowns === 1 ? '' : 's'} waiting —{' '}
          <Link href="/admin/gallery" className="underline">
            handle now
          </Link>
          .
        </p>
      ) : null}

      <Card title="Latest web orders">
        {latest.length === 0 ? (
          <Empty>No web orders yet.</Empty>
        ) : (
          <ul>
            {latest.map((o) => {
              const [tone, label] = ORDER_PILL[o.status];
              return (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center gap-3 border-b-2 border-surface-2 py-2.5 last:border-0"
                >
                  <span className="font-mono font-bold">{o.code}</span>
                  <Pill tone={tone}>{label}</Pill>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {o.customerName} · {o.lines.map((l) => `${l.qty}× ${l.itemName}`).join(', ')}
                  </span>
                  <span className="text-sm font-bold tabular-nums">{money(o.totalCents)}</span>
                  <span className="text-sm text-ink-muted">{clockTime(o.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-sm">
          <Link href="/admin/orders" className="font-bold underline">
            All orders →
          </Link>{' '}
          ·{' '}
          <Link href="/admin/analytics" className="font-bold underline">
            Analytics →
          </Link>
        </p>
      </Card>
    </AdminPage>
  );
}
