import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrderDetail } from '@/lib/db/queries/orders';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { money, orderNumber, dateTime, duration } from '@/lib/format';

// Full order detail, including the raw hydrated Square payload for debugging.
export const dynamic = 'force-dynamic';

const TICKET_LABEL: Record<string, string> = {
  pending: 'Waiting',
  in_progress: 'Cooking',
  done: 'Done',
  cancelled: 'Cancelled',
};

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0 text-right text-ink">{children}</dd>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--rule)] bg-bg-raised px-4 py-3">
      <h2 className="text-xs uppercase tracking-wide text-ink-3">{title}</h2>
      <div className="mt-1 text-sm">{children}</div>
    </section>
  );
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail) notFound();

  const { order, items, payments, ticket } = detail;
  const ticketSeconds = ticket
    ? ((ticket.completedAt ?? new Date()).getTime() - ticket.startedAt.getTime()) / 1000
    : null;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/orders" className="text-sm text-ink-2 hover:text-ink">
        ← Orders
      </Link>

      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h1 className="font-mono text-2xl font-semibold text-ink">
          {orderNumber(order.squareOrderId, order.id)}
        </h1>
        <StatusBadge status={order.status} />
        <span className="text-sm text-ink-3">Opened {dateTime(order.openedAt)}</span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--rule)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--rule)] text-left text-xs uppercase tracking-wide text-ink-3">
                <th className="px-4 py-2 font-medium">Item</th>
                <th className="px-4 py-2 text-right font-medium">Qty</th>
                <th className="px-4 py-2 text-right font-medium">Price</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-ink-3">
                    No line items.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--rule)] align-top">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-ink">{item.nameSnapshot}</div>
                      {item.modifiers.map((m) => (
                        <div key={m.id} className="text-ink-3">
                          + {m.nameSnapshot}
                          {m.priceCentsDelta !== 0 ? (
                            <span className="ml-1 font-mono tabular-nums">{money(m.priceCentsDelta)}</span>
                          ) : null}
                        </div>
                      ))}
                      {item.notes ? <div className="mt-0.5 italic text-ink-2">“{item.notes}”</div> : null}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{item.qty}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-ink-2">
                      {money(item.unitPriceCents)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-ink">
                      {money(item.lineTotalCents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="font-mono tabular-nums">
              {(
                [
                  ['Subtotal', order.subtotalCents],
                  ['Tax', order.taxCents],
                  ['Tip', order.tipCents],
                ] as const
              ).map(([label, cents]) => (
                <tr key={label} className="text-ink-2">
                  <td colSpan={3} className="px-4 pt-2 text-right font-sans">
                    {label}
                  </td>
                  <td className="px-4 pt-2 text-right">{money(cents)}</td>
                </tr>
              ))}
              <tr className="text-ink">
                <td colSpan={3} className="px-4 pb-3 pt-2 text-right font-sans font-medium">
                  Total
                </td>
                <td className="px-4 pb-3 pt-2 text-right text-base font-semibold">{money(order.totalCents)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <aside className="flex flex-col gap-4">
          <Panel title="Kitchen">
            {ticket ? (
              <dl className="divide-y divide-[var(--rule)]">
                <Field label="State">{TICKET_LABEL[ticket.state] ?? ticket.state}</Field>
                <Field label="Started">{dateTime(ticket.startedAt)}</Field>
                {ticket.completedAt ? <Field label="Completed">{dateTime(ticket.completedAt)}</Field> : null}
                <Field label={ticket.completedAt ? 'Ticket time' : 'In kitchen'}>
                  <span className="font-mono tabular-nums">{duration(ticketSeconds)}</span>
                </Field>
              </dl>
            ) : (
              <p className="py-1.5 text-ink-3">No kitchen ticket.</p>
            )}
          </Panel>

          <Panel title="Payments">
            {payments.length === 0 ? (
              <p className="py-1.5 text-ink-3">No payments recorded.</p>
            ) : (
              <ul className="divide-y divide-[var(--rule)]">
                {payments.map((p) => (
                  <li key={p.id} className="py-1.5">
                    <div className="flex justify-between gap-4">
                      <span className="text-ink">{p.cardBrand ?? 'Payment'}</span>
                      <span className="font-mono tabular-nums text-ink">{money(p.amountCents)}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-xs text-ink-3">
                      <span>{p.status}</span>
                      {p.tipCents > 0 ? <span className="font-mono">tip {money(p.tipCents)}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Details">
            <dl className="divide-y divide-[var(--rule)]">
              <Field label="Store">{order.storeName}</Field>
              {order.closedAt ? <Field label="Closed">{dateTime(order.closedAt)}</Field> : null}
              <Field label="Square ID">
                <span className="break-all font-mono text-xs">{order.squareOrderId ?? '—'}</span>
              </Field>
              <Field label="Version">
                <span className="font-mono">{order.squareVersion ?? '—'}</span>
              </Field>
            </dl>
          </Panel>
        </aside>
      </div>

      <details className="mt-6 rounded-[var(--radius-lg)] border border-[var(--rule)]">
        <summary className="cursor-pointer px-4 py-2.5 text-sm text-ink-2 hover:text-ink">
          Raw Square payload
        </summary>
        {order.rawPayload ? (
          <pre className="max-h-[32rem] overflow-auto border-t border-[var(--rule)] bg-bg-sunken p-4 font-mono text-xs leading-relaxed text-ink-2">
            {JSON.stringify(order.rawPayload, null, 2)}
          </pre>
        ) : (
          <p className="border-t border-[var(--rule)] px-4 py-3 text-sm text-ink-3">No payload stored.</p>
        )}
      </details>
    </div>
  );
}
