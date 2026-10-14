import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteConfirm, NoticeBanner } from '@/components/dashboard/form';
import { ButtonLink, Panel, Pill } from '@/components/website/ui';
import { siteApi, siteAsset, sitePage, SiteUnavailableError } from '@/lib/site/api';
import { dateTime } from '@/lib/format';
import { deleteProduct } from '../../actions';
import { ProductEditor } from '../../ProductEditor';
import { merchNotice } from '../../shared';

export const dynamic = 'force-dynamic';

export default async function MerchProductPage({ params, searchParams }: PageProps<'/website/merch/products/[id]'>): Promise<React.JSX.Element> {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const result = await siteApi('merch.getProduct', { id });
  if (!result.ok) {
    if (result.error === 'Product not found.') notFound();
    throw new SiteUnavailableError(result.error);
  }
  const p = result.data;

  return (
    <div className="grid max-w-4xl gap-4">
      <Link href="/website/merch" className="text-sm text-ink-2 hover:text-ink">
        ← Merch
      </Link>
      <NoticeBanner notice={merchNotice(sp.notice)} />
      <Panel
        title={p.name}
        description={`Last saved ${dateTime(p.updatedAt)}`}
        actions={
          <>
            {p.active ? <Pill tone="ok">Live</Pill> : <Pill>Hidden</Pill>}
            {p.active ? (
              <ButtonLink href={sitePage(`/merch/${p.slug}`)} external>
                View ↗
              </ButtonLink>
            ) : null}
          </>
        }
      >
        <ProductEditor key={p.updatedAt} product={p} photoSrc={siteAsset(p.photoUrl)} />
      </Panel>
      <Panel title="Delete" description="Past orders keep their item names. Prefer “Hide” if you might sell it again.">
        <DeleteConfirm action={deleteProduct.bind(null, p.id)} what="product" consequence="It disappears from the website. This can’t be undone." />
      </Panel>
    </div>
  );
}
