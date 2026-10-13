import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Field, inputClass, PrimaryButton } from '@/components/dashboard/form';
import { ActionForm, FieldError } from '@/components/website/ActionForm';
import { Panel } from '@/components/website/ui';
import { dateTime, money } from '@/lib/format';
import { siteApi, SiteUnavailableError } from '@/lib/site/api';
import { fulfillOrder, setOrderStatus } from '../../actions';
import { OrderStatusPill } from '../../shared';

export const dynamic = 'force-dynamic';

export default async function MerchOrderPage({ params }: PageProps<'/website/merch/orders/[id]'>): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const result = await siteApi('merch.getOrder', { id });
  if (!result.ok) {
    if (result.error === 'Order not found.') notFound();
    throw new SiteUnavailableError(result.error);
  }
  const o = result.data;
  const a = o.shippingAddress;
  const canFulfill = o.status === 'paid' || o.status === 'fulfilled';

  return (
    <div className="grid max-w-4xl gap-4">
      <Link href="/website/merch/orders" className="text-sm text-ink-2 hover:text-ink">
        ← Merch orders
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-2xl text-ink">Order #{o.ref}</h2>
        <OrderStatusPill status={o.status} />
        <span className="text-sm text-ink-3">
          Placed {dateTime(o.createdAt)}
          {o.fulfilledAt ? ` · fulfilled ${dateTime(o.fulfilledAt)}` : ''}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Items">
          <ul className="grid gap-1 text-sm">
            {o.lines.map((l) => (
              <li key={l.variantId} className="flex justify-between gap-3">
                <span>
                  <span className="font-medium">{l.qty} ×</span> {l.productName}
                  {l.variantLabel ? <span className="text-ink-3"> ({l.variantLabel})</span> : null}
                </span>
                <span className="font-mono tabular-nums">{money(l.unitCents * l.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 border-t border-[var(--rule)] pt-2 text-sm">
            <dt className="text-ink-2">Subtotal</dt>
            <dd className="text-right font-mono tabular-nums">{money(o.subtotalCents)}</dd>
            <dt className="text-ink-2">Shipping</dt>
            <dd className="text-right font-mono tabular-nums">{money(o.shippingCents)}</dd>
            <dt className="text-ink-2">Tax</dt>
            <dd className="text-right font-mono tabular-nums">{money(o.taxCents)}</dd>
            <dt className="font-medium">Total</dt>
            <dd className="text-right font-mono font-medium tabular-nums">{money(o.totalCents)}</dd>
          </dl>
        </Panel>

        <Panel title={o.delivery === 'pickup' ? 'Pickup at the truck' : 'Ship to'}>
          <div className="text-sm">
            <p className="font-medium text-ink">{o.name ?? '—'}</p>
            {o.email ? (
              <a href={`mailto:${o.email}`} className="text-accent hover:underline">
                {o.email}
              </a>
            ) : null}
            {a && o.delivery === 'ship' ? (
              <address className="mt-2 not-italic text-ink-2">
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
              <p className="mt-2 text-ink-3">{o.status === 'pending' ? 'No address yet (unpaid).' : 'No address on file.'}</p>
            ) : null}
            {o.trackingNumber ? <p className="mt-2 text-ink-2">Tracking: {o.trackingNumber}</p> : null}
          </div>
        </Panel>
      </div>

      {canFulfill ? (
        <Panel title={o.status === 'paid' ? 'Fulfill' : 'Fulfillment'}>
          <ActionForm action={fulfillOrder.bind(null, o.id)} className="grid gap-3">
            {o.delivery === 'ship' ? (
              <Field label="Tracking number" className="max-w-sm">
                <input name="tracking" maxLength={80} defaultValue={o.trackingNumber ?? ''} className={inputClass} />
                <FieldError name="tracking" />
              </Field>
            ) : null}
            {o.email ? (
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="notify" defaultChecked className="size-4 accent-[var(--accent)]" />
                {o.delivery === 'ship' ? 'Email the customer that it shipped' : 'Email the customer that it’s ready at the truck'}
              </label>
            ) : null}
            <div>
              <PrimaryButton>
                {o.status === 'fulfilled' ? 'Update' : o.delivery === 'ship' ? 'Mark shipped' : 'Mark picked up / ready'}
              </PrimaryButton>
            </div>
          </ActionForm>
        </Panel>
      ) : null}

      <Panel title="Refunds" description="Refund in Stripe (it returns the card payment and the tax), then mark it here so the books match.">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {o.stripePaymentUrl ? (
            <a href={o.stripePaymentUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              Open payment in Stripe ↗
            </a>
          ) : null}
          {o.status !== 'refunded' && o.status !== 'cancelled' ? (
            <ActionForm action={setOrderStatus.bind(null, o.id, o.status === 'pending' ? 'cancelled' : 'refunded')}>
              <button
                type="submit"
                className="rounded-[var(--radius)] border border-[var(--rule)] px-3 py-1.5 text-sm text-ink-2 hover:bg-bg-sunken hover:text-ink"
              >
                {o.status === 'pending' ? 'Mark cancelled' : 'Mark refunded'}
              </button>
            </ActionForm>
          ) : (
            <span className="text-ink-3">Nothing to do — this order is {o.status}.</span>
          )}
        </div>
      </Panel>
    </div>
  );
}
