import Link from 'next/link';
import { NoticeBanner } from '@/components/dashboard/form';
import { ActionForm } from '@/components/website/ActionForm';
import { ButtonLink, Empty, Panel, Pill } from '@/components/website/ui';
import { money } from '@/lib/format';
import { siteAsset, siteData, sitePage } from '@/lib/site/api';
import { setActive } from './actions';
import { MerchSubnav, merchNotice, Thumb } from './shared';
import { StockForm } from './StockForm';

export const dynamic = 'force-dynamic';

export default async function MerchProductsPage({ searchParams }: PageProps<'/website/merch'>): Promise<React.JSX.Element> {
  const [{ products, toShip, stripeConfigured }, sp] = await Promise.all([siteData('merch.overview', {}), searchParams]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MerchSubnav active="products" toShip={toShip} />
        <ButtonLink href="/website/merch/products/new" primary>
          + New product
        </ButtonLink>
      </div>
      <NoticeBanner notice={merchNotice(sp.notice)} />

      {!stripeConfigured ? (
        <div role="status" className="border-l-2 border-[var(--warn)] px-3 py-1.5 text-sm text-warn">
          Stripe isn’t connected on the website, so the merch checkout runs in test mode and can’t take real payments yet. Add{' '}
          <code className="font-mono">STRIPE_SECRET_KEY</code> to the website to go live.
        </div>
      ) : null}

      <Panel
        title="Products"
        description={
          <>
            Shown on <a href={sitePage('/merch')} target="_blank" rel="noreferrer" className="text-accent hover:underline">/merch ↗</a> in this order.
            Stock counts down by itself as orders are paid.
          </>
        }
      >
        {products.length === 0 ? (
          <Empty>No products yet. Add your first one with “New product”.</Empty>
        ) : (
          <ul className="divide-y divide-[var(--rule)]">
            {products.map((p) => {
              const limited = p.variants.filter((v) => v.stock !== null);
              const total = limited.reduce((n, v) => n + (v.stock ?? 0), 0);
              const out = p.variants.filter((v) => v.stock === 0);
              return (
                <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <Thumb src={siteAsset(p.photoUrl)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/website/merch/products/${p.id}`} className="font-medium text-ink hover:underline">
                          {p.name}
                        </Link>
                        {p.active ? <Pill tone="ok">Live</Pill> : <Pill>Hidden</Pill>}
                        {p.soldOut ? <Pill tone="danger">Sold out</Pill> : null}
                        {p.fulfillment === 'pod' ? <Pill tone="accent">Print on demand</Pill> : null}
                      </div>
                      <p className="mt-0.5 text-sm text-ink-3">
                        {p.fromCents < p.priceCents ? `from ${money(p.fromCents)}` : money(p.priceCents)} · {p.variants.length} variant
                        {p.variants.length === 1 ? '' : 's'} · {limited.length === 0 ? 'unlimited stock' : `${total} in stock`}
                        {out.length && !p.soldOut ? ` · out: ${out.map((v) => v.label || 'default').join(', ')}` : ''}
                      </p>
                      {p.variants.length ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-sm text-accent hover:underline">Adjust stock</summary>
                          <div className="mt-2 grid gap-2 border-l border-[var(--rule)] pl-3">
                            {p.variants.map((v) => (
                              <StockForm key={v.id} variantId={v.id} label={v.label} stock={v.stock} />
                            ))}
                            <p className="text-xs text-ink-3">Blank = unlimited (print on demand).</p>
                          </div>
                        </details>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                      <ActionForm action={setActive.bind(null, p.id, !p.active)}>
                        <button
                          type="submit"
                          className="whitespace-nowrap rounded-[var(--radius)] border border-[var(--rule)] px-2.5 py-1 text-sm text-ink-2 hover:bg-bg-sunken hover:text-ink"
                        >
                          {p.active ? 'Hide' : 'Make live'}
                        </button>
                      </ActionForm>
                      <Link
                        href={`/website/merch/products/${p.id}`}
                        className="whitespace-nowrap rounded-[var(--radius)] px-2.5 py-1 text-sm text-ink-2 hover:bg-bg-sunken hover:text-ink"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
