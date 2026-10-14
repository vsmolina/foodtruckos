import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { FulfillForm } from '@/components/admin/merch/FulfillForm';
import { AdminPage, Card, Pill } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { merchOrders } from '@/lib/db/schema';
import { dateTime, money } from '@/lib/format';
import { setOrderStatus } from '../../actions';
import { STATUS_LABEL, STATUS_TONE } from '@/components/admin/merch/status';

type Props = { params: Promise<{ id: string }> };

type Address = {
  name?: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

export default async function AdminMerchOrderPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [o] = await db.select().from(merchOrders).where(eq(merchOrders.id, id));
  if (!o) notFound();
  const a = (o.shippingAddress ?? null) as Address | null;
  const live = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? '' : 'test/';

  return (
    <AdminPage title={`Order #${o.id.slice(-6).toUpperCase()}`}>
      <Link href="/admin/merch/orders" className="font-bold underline">
        ← Merch orders
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Pill>
        <span className="text-sm text-ink-muted">Placed {dateTime(o.createdAt)}</span>
        {o.fulfilledAt ? (
          <span className="text-sm text-ink-muted">· fulfilled {dateTime(o.fulfilledAt)}</span>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Items">
          <ul className="flex flex-col gap-1">
            {o.lines.map((l) => (
              <li key={l.variantId} className="flex justify-between gap-3">
                <span>
                  <b>{l.qty} ×</b> {l.productName}{' '}
                  {l.variantLabel ? (
                    <span className="text-ink-muted">({l.variantLabel})</span>
                  ) : null}
                </span>
                <span className="tabular-nums">{money(l.unitCents * l.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 border-t-2 border-surface-2 pt-2 text-sm">
            <dt>Subtotal</dt>
            <dd className="text-right tabular-nums">{money(o.subtotalCents)}</dd>
            <dt>Shipping</dt>
            <dd className="text-right tabular-nums">{money(o.shippingCents)}</dd>
            <dt>Tax</dt>
            <dd className="text-right tabular-nums">{money(o.taxCents)}</dd>
            <dt className="font-bold">Total</dt>
            <dd className="text-right font-bold tabular-nums">{money(o.totalCents)}</dd>
          </dl>
        </Card>
        <Card title={o.delivery === 'pickup' ? 'Pickup at the truck' : 'Ship to'}>
          <p className="font-bold">{o.name ?? '—'}</p>
          {o.email ? (
            <p>
              <a href={`mailto:${o.email}`} className="underline">
                {o.email}
              </a>
            </p>
          ) : null}
          {a && o.delivery === 'ship' ? (
            <address className="mt-2 not-italic">
              {a.line1}
              {a.line2 ? (
                <>
                  <br />
                  {a.line2}
                </>
              ) : null}
              <br />
              {a.city}, {a.state} {a.postal_code}
            </address>
          ) : o.delivery === 'ship' ? (
            <p className="text-ink-muted">
              {o.status === 'pending' ? 'No address yet (unpaid).' : 'No address on file.'}
            </p>
          ) : null}
          {o.trackingNumber ? <p className="mt-2 text-sm">Tracking: {o.trackingNumber}</p> : null}
        </Card>
      </div>
      {o.status === 'paid' || o.status === 'fulfilled' ? (
        <Card title={o.status === 'paid' ? 'Fulfill' : 'Fulfillment'}>
          <FulfillForm
            id={o.id}
            delivery={o.delivery}
            tracking={o.trackingNumber ?? ''}
            hasEmail={!!o.email}
            done={o.status === 'fulfilled'}
          />
        </Card>
      ) : null}
      <Card title="Refunds">
        <p className="text-sm">
          Refund in Stripe (it returns the card payment and the tax), then mark it here so the books
          match.{' '}
          {o.stripePaymentIntentId ? (
            <a
              href={`https://dashboard.stripe.com/${live}payments/${o.stripePaymentIntentId}`}
              className="font-bold underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open payment in Stripe ↗
            </a>
          ) : null}
        </p>
        {o.status !== 'refunded' && o.status !== 'cancelled' ? (
          <form action={setOrderStatus} className="mt-3">
            <input type="hidden" name="id" value={o.id} />
            <input
              type="hidden"
              name="status"
              value={o.status === 'pending' ? 'cancelled' : 'refunded'}
            />
            <button
              type="submit"
              className="min-h-11 rounded-sm border-2 border-outline bg-surface-2 px-4 text-sm font-bold"
            >
              {o.status === 'pending' ? 'Mark cancelled' : 'Mark refunded'}
            </button>
          </form>
        ) : null}
      </Card>
    </AdminPage>
  );
}
