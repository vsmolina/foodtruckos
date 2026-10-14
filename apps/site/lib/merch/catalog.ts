import 'server-only';
import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { merchProducts, merchVariants } from '@/lib/db/schema';

export type Product = typeof merchProducts.$inferSelect;
export type Variant = typeof merchVariants.$inferSelect;
export type ProductWithVariants = Product & {
  variants: Variant[];
  soldOut: boolean;
  fromCents: number;
};

/** "M / Black", "One size / Rosa", or "" for single-variant products. */
export function variantLabel(v: Pick<Variant, 'size' | 'color'>): string {
  return [v.size, v.color].filter(Boolean).join(' / ');
}

export function variantPrice(
  p: Pick<Product, 'priceCents'>,
  v: Pick<Variant, 'priceCents'>,
): number {
  return v.priceCents ?? p.priceCents;
}

/** null stock = unlimited (print on demand). */
export function inStock(v: Pick<Variant, 'stock'>): boolean {
  return v.stock === null || v.stock > 0;
}

function withVariants(products: Product[], variants: Variant[]): ProductWithVariants[] {
  const byProduct = Map.groupBy(variants, (v) => v.productId);
  return products.map((p) => {
    const vs = byProduct.get(p.id) ?? [];
    return {
      ...p,
      variants: vs,
      soldOut: vs.length === 0 || vs.every((v) => !inStock(v)),
      fromCents: vs.length ? Math.min(...vs.map((v) => variantPrice(p, v))) : p.priceCents,
    };
  });
}

export async function listProducts(
  opts: { includeInactive?: boolean } = {},
): Promise<ProductWithVariants[]> {
  const products = await db
    .select()
    .from(merchProducts)
    .where(opts.includeInactive ? undefined : eq(merchProducts.active, true))
    .orderBy(asc(merchProducts.sortOrder), asc(merchProducts.name));
  if (products.length === 0) return [];
  const variants = await db
    .select()
    .from(merchVariants)
    .where(
      inArray(
        merchVariants.productId,
        products.map((p) => p.id),
      ),
    )
    .orderBy(asc(merchVariants.sortOrder));
  return withVariants(products, variants);
}

export async function getProductBySlug(slug: string): Promise<ProductWithVariants | null> {
  const [p] = await db.select().from(merchProducts).where(eq(merchProducts.slug, slug)).limit(1);
  if (!p || !p.active) return null;
  const variants = await db
    .select()
    .from(merchVariants)
    .where(eq(merchVariants.productId, p.id))
    .orderBy(asc(merchVariants.sortOrder));
  return withVariants([p], variants)[0]!;
}

/** Stripe tax codes: apparel vs general tangible goods. */
export function taxCodeFor(product: Pick<Product, 'slug' | 'name'>): string {
  return /tee|shirt|hoodie|hat|cap|beanie|sock|apparel/i.test(`${product.slug} ${product.name}`)
    ? 'txcd_30011000' // clothing
    : 'txcd_99999999'; // general tangible goods (stickers, etc.)
}

export function shippingCents(): number {
  const n = Number(process.env.MERCH_SHIPPING_CENTS ?? 600);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 600;
}
