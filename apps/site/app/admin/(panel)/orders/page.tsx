import { desc, gte } from 'drizzle-orm';
import { AdminPage, Card, Empty, Pill } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { webOrders } from '@/lib/db/schema';
import { paymentsMock } from '@/lib/env';
import { clockTime, dateTime, money } from '@/lib/format';
import { setStatusAction } from './actions';

export const dynamic = 'force-dynamic';

const TONE = {
  pending_payment: 'grey',
  received: 'blue',
  preparing: 'amber',
  ready: 'green',
  picked_up: 'grey',
  cancelled: 'red',
  failed: 'red',
} as const;
const LABEL = {
  pending_payment: 'Unpaid',
  received: 'Received',
  preparing: 'Preparing',
  ready: 'Ready',
  picked_up: 'Picked up',
  cancelled: 'Cancelled',
  failed: 'Failed',
} as const;

/** "Tonight" = the last 16 hours, so a shift that crosses midnight stays together. */
function tonightStart(): Date {
  return new Date(Date.now() - 16 * 3600_000);
}

export default async function AdminOrdersPage() {
  await requireAdmin();
  const orders = await db.select().from(webOrders).where(gte(webOrders.createdAt, tonightStart())).orderBy(desc(webOrders.createdAt)).limit(200);
  const paid = orders.filter((o) => o.paidAt);

  return (
    <AdminPage title="Web orders">
      <p className="text-ink-muted">
        Tonight (last 16 h): <strong className="text-ink">{paid.length}</strong> paid ·{' '}
        <strong className="text-ink">{money(paid.reduce((s, o) => s + o.totalCents, 0))}</strong>. Status updates come from the
        kitchen screen automatically; use the buttons only if the KDS link is down{paymentsMock() ? ' (or in test mode)' : ''}. Cancelling here doesn’t refund — refund in the Square Dashboard.
      </p>
      <Card>
        {orders.length === 0 ? (
          <Empty>No web orders tonight.</Empty>
        ) : (
          <ul>
            {orders.map((o) => (
              <li key={o.id} className="flex flex-col gap-2 border-b-2 border-surface-2 py-3 last:border-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-display text-xl tracking-wider">{o.code}</span>
                  <Pill tone={TONE[o.status]}>{LABEL[o.status]}</Pill>
                  <span className="font-bold">{o.customerName}</span>
                  <span className="text-sm text-ink-muted">···{o.phone.slice(-4)}</span>
                  {o.smsOptIn ? <span className="text-sm text-ink-muted">· text on ready{o.readySmsSentAt ? ' (sent)' : ''}</span> : null}
                  <span className="ml-auto text-sm text-ink-muted" title={dateTime(o.createdAt)}>
                    {clockTime(o.createdAt)}
                  </span>
                </div>
                <p className="text-sm">
                  {o.lines.map((l) => `${l.qty}× ${l.itemName}${l.variationName !== 'Regular' ? ` (${l.variationName})` : ''}`).join(', ')}
                  <span className="font-bold"> · {money(o.totalCents)}</span>
                </p>
                {o.error ? <p className="text-sm text-danger">{o.error}</p> : null}
                {['received', 'preparing', 'ready'].includes(o.status) ? (
                  <form action={setStatusAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={o.id} />
                    {o.status === 'received' ? <StatusButton value="preparing">Preparing</StatusButton> : null}
                    {o.status !== 'ready' ? <StatusButton value="ready">Ready (texts them)</StatusButton> : null}
                    <StatusButton value="picked_up">Picked up</StatusButton>
                    <StatusButton value="cancelled" danger>
                      Cancel
                    </StatusButton>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AdminPage>
  );
}

function StatusButton({ value, children, danger }: { value: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="submit"
      name="status"
      value={value}
      className={`min-h-11 rounded-sm border-2 border-outline px-3 text-sm font-bold ${danger ? 'bg-surface text-danger' : 'bg-surface-2 text-ink'}`}
    >
      {children}
    </button>
  );
}
