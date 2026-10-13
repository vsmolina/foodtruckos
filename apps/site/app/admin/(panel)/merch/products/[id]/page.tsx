import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { ProductForm } from '@/components/admin/merch/ProductForm';
import { AdminPage, Card } from '@/components/admin/ui';
import { FormNotice } from '@/components/ui/Field';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { merchProducts, merchVariants } from '@/lib/db/schema';
import { deleteProduct } from '../../actions';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> };

const dollars = (c: number | null) => (c == null ? '' : (c / 100).toFixed(2).replace(/\.00$/, ''));

export default async function AdminProductPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const saved = (await searchParams).saved === '1';
  const isNew = id === 'new';
  let product = null;
  let variants: Array<typeof merchVariants.$inferSelect> = [];
  if (!isNew) {
    if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
    [product] = await db.select().from(merchProducts).where(eq(merchProducts.id, id));
    if (!product) notFound();
    variants = await db
      .select()
      .from(merchVariants)
      .where(eq(merchVariants.productId, id))
      .orderBy(asc(merchVariants.sortOrder));
  }

  return (
    <AdminPage title={isNew ? 'New product' : product!.name}>
      <Link href="/admin/merch" className="font-bold underline">
        ← Merch
      </Link>
      {saved ? <FormNotice tone="success">Product created.</FormNotice> : null}
      <Card>
        <ProductForm
          product={{
            id: product?.id ?? '',
            name: product?.name ?? '',
            slug: product?.slug ?? '',
            description: product?.description ?? '',
            price: dollars(product?.priceCents ?? null),
            fulfillment: product?.fulfillment ?? 'self',
            providerRef: product?.providerRef ?? '',
            sortOrder: product?.sortOrder ?? 0,
            active: product?.active ?? true,
            photoUrl: product?.photoUrl ?? null,
            variants: variants.map((v) => ({
              id: v.id,
              size: v.size ?? '',
              color: v.color ?? '',
              price: dollars(v.priceCents),
              stock: v.stock == null ? '' : String(v.stock),
              sku: v.sku ?? '',
            })),
          }}
        />
      </Card>
      {product ? (
        <Card title="Delete">
          <p className="mb-3 text-sm text-ink-muted">
            Past orders keep their item names. Prefer “Hide” if you might sell it again.
          </p>
          <form action={deleteProduct}>
            <input type="hidden" name="id" value={product.id} />
            <label className="mb-3 flex min-h-11 items-center gap-2 text-sm font-bold">
              <input type="checkbox" name="confirm" value="yes" required className="h-5 w-5" /> Yes,
              delete this product
            </label>
            <button
              type="submit"
              className="min-h-11 rounded-sm border-2 border-outline bg-danger-fill px-4 font-bold text-on-chile"
            >
              Delete product
            </button>
          </form>
        </Card>
      ) : null}
    </AdminPage>
  );
}
