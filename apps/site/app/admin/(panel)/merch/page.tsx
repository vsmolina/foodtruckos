import Link from 'next/link';
import { MerchTabs } from '@/components/admin/merch/MerchTabs';
import { merchToShip } from '@/components/admin/merch/queries';
import { AdminPage, Empty, Pill } from '@/components/admin/ui';
import { buttonClass } from '@/components/ui/Button';
import { requireAdmin } from '@/lib/auth';
import { money } from '@/lib/format';
import { listProducts, variantLabel } from '@/lib/merch/catalog';
import { toggleProductActive } from './actions';

export default async function AdminMerchPage() {
  await requireAdmin();
  const [products, toShip] = await Promise.all([
    listProducts({ includeInactive: true }),
    merchToShip(),
  ]);
  return (
    <AdminPage
      title="Merch"
      actions={
        <Link href="/admin/merch/products/new" className={buttonClass('primary', 'sm')}>
          + New product
        </Link>
      }
    >
      <MerchTabs active="products" toShip={toShip} />
      {products.length === 0 ? (
        <Empty>No products yet.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {products.map((p) => {
            const limited = p.variants.filter((v) => v.stock !== null);
            const total = limited.reduce((n, v) => n + (v.stock ?? 0), 0);
            const out = p.variants.filter((v) => v.stock === 0);
            return (
              <li
                key={p.id}
                className="flex flex-col gap-3 rounded-md border-2 border-outline bg-surface p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/merch/products/${p.id}`}
                      className="text-lg font-bold underline"
                    >
                      {p.name}
                    </Link>
                    {p.active ? <Pill tone="green">Live</Pill> : <Pill>Hidden</Pill>}
                    {p.fulfillment === 'pod' ? <Pill tone="blue">Print on demand</Pill> : null}
                    {p.soldOut ? <Pill tone="red">Sold out</Pill> : null}
                  </div>
                  <p className="text-sm text-ink-muted">
                    {money(p.priceCents)} · {p.variants.length} variant
                    {p.variants.length === 1 ? '' : 's'} ·{' '}
                    {limited.length === 0 ? 'unlimited stock' : `${total} in stock`}
                    {out.length && !p.soldOut ? ` · out: ${out.map(variantLabel).join(', ')}` : ''}
                  </p>
                </div>
                <form action={toggleProductActive}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="active" value={p.active ? '0' : '1'} />
                  <button type="submit" className={buttonClass(p.active ? 'paper' : 'agave', 'sm')}>
                    {p.active ? 'Hide' : 'Make live'}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </AdminPage>
  );
}
