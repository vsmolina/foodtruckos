import Link from 'next/link';
import { listOrders, ORDER_STATUSES, type OrderStatus } from '@/lib/db/queries/orders';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { money, orderNumber, dateTime } from '@/lib/format';

// Order history: filters live in the URL (plain GET form), so every view is
// linkable and works without client JS.
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Params = { [key: string]: string | string[] | undefined };

const one = (v: string | string[] | undefined): string | undefined =>
  (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

function parseFilters(sp: Params) {
  const from = one(sp.from);
  const to = one(sp.to);
  const status = one(sp.status);
  const page = Number.parseInt(one(sp.page) ?? '1', 10);
  return {
    from: from && DATE_RE.test(from) ? from : undefined,
    to: to && DATE_RE.test(to) ? to : undefined,
    status: ORDER_STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : undefined,
    q: one(sp.q)?.slice(0, 64),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

type Filters = ReturnType<typeof parseFilters>;

function hrefFor(f: Filters, page: number): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.status) p.set('status', f.status);
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (page > 1) p.set('page', String(page));
  const s = p.toString();
  return s ? `/orders?${s}` : '/orders';
}

const inputClass =
  'border-0 border-b border-[var(--rule)] bg-transparent px-0 py-1 text-sm text-ink focus:border-[var(--accent)] focus:outline-none';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}): Promise<React.JSX.Element> {
  const filters = parseFilters(await searchParams);
  const { rows, total, page, pageCount } = await listOrders({ ...filters, pageSize: PAGE_SIZE });
  const filtered = Boolean(filters.q || filters.status || filters.from || filters.to);
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl text-ink">Orders</h1>

      <form method="get" action="/orders" className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ink-3">Order #</span>
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="#A1B2"
            className={`${inputClass} w-32 font-mono`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ink-3">Status</span>
          <select name="status" defaultValue={filters.status ?? ''} className={`${inputClass} w-32`}>
            <option value="">All</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0]!.toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ink-3">From</span>
          <input type="date" name="from" defaultValue={filters.from} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ink-3">To</span>
          <input type="date" name="to" defaultValue={filters.to} className={inputClass} />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-[var(--radius)] bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:opacity-90"
          >
            Filter
          </button>
          {filtered ? (
            <Link href="/orders" className="text-sm text-ink-2 hover:text-ink">
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--rule)]">
        {rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-ink-3">
            {filtered ? 'No orders match these filters.' : 'No orders yet.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--rule)] text-left text-xs uppercase tracking-wide text-ink-3">
                <th className="px-4 py-2 font-medium">Order</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Items</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium">Opened</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-b border-[var(--rule)] last:border-0 hover:bg-bg-sunken">
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
                  <td className="px-4 py-2.5 text-ink-3">{o.itemCount}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-ink">
                    {money(o.totalCents)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink-3">{dateTime(o.openedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > 0 ? (
        <nav className="mt-3 flex items-center justify-between text-sm text-ink-3" aria-label="Pagination">
          <span className="tabular-nums">
            {first}–{last} of {total}
          </span>
          <div className="flex items-center gap-4">
            {page > 1 ? (
              <Link href={hrefFor(filters, page - 1)} className="text-ink-2 hover:text-ink">
                ← Newer
              </Link>
            ) : (
              <span className="opacity-40">← Newer</span>
            )}
            <span className="tabular-nums">
              Page {page} of {pageCount}
            </span>
            {page < pageCount ? (
              <Link href={hrefFor(filters, page + 1)} className="text-ink-2 hover:text-ink">
                Older →
              </Link>
            ) : (
              <span className="opacity-40">Older →</span>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
