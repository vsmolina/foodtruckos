import 'server-only';
import { and, asc, count, desc, eq, inArray, notInArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type {
  MerchOrderDto,
  MerchOrderSummaryDto,
  MerchProductDto,
  MerchVariantInput,
} from '@barrio/site-contract';
import { db } from '@/lib/db/client';
import { merchOrders, merchProducts, merchVariants } from '@/lib/db/schema';
import { env, has } from '@/lib/env';
import { listProducts, variantLabel, type ProductWithVariants } from '@/lib/merch/catalog';
import { sendEmail } from '@/lib/messaging/email';
import { UploadError, storeImage } from '@/lib/storage';
import { fail, invalid, ok, type Result } from './result';

// Merch products, variants, stock and orders. No auth here: callers (the
// site's admin server actions, the admin API) check it first.

const refresh = (): void => revalidatePath('/', 'layout');

const UUID = /^[0-9a-f-]{36}$/;
const IdSchema = z.object({ id: z.string().regex(UUID, 'Unknown id') });

// ---------------------------------------------------------------- mapping ----

type OrderRow = typeof merchOrders.$inferSelect;

function productDto(p: ProductWithVariants): MerchProductDto {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    photoUrl: p.photoUrl,
    priceCents: p.priceCents,
    fulfillment: p.fulfillment === 'pod' ? 'pod' : 'self',
    providerRef: p.providerRef,
    active: p.active,
    sortOrder: p.sortOrder,
    variants: p.variants.map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      label: variantLabel(v),
      priceCents: v.priceCents,
      stock: v.stock,
      sku: v.sku,
      sortOrder: v.sortOrder,
    })),
    soldOut: p.soldOut,
    fromCents: p.fromCents,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export const orderRef = (id: string): string => id.slice(-6).toUpperCase();

function orderSummary(o: OrderRow): MerchOrderSummaryDto {
  return {
    id: o.id,
    ref: orderRef(o.id),
    status: o.status,
    name: o.name,
    email: o.email,
    delivery: o.delivery === 'pickup' ? 'pickup' : 'ship',
    lines: o.lines,
    totalCents: o.totalCents,
    createdAt: o.createdAt.toISOString(),
  };
}

function orderDto(o: OrderRow): MerchOrderDto {
  const test = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? '' : 'test/';
  return {
    ...orderSummary(o),
    subtotalCents: o.subtotalCents,
    shippingCents: o.shippingCents,
    taxCents: o.taxCents,
    shippingAddress: (o.shippingAddress ?? null) as MerchOrderDto['shippingAddress'],
    trackingNumber: o.trackingNumber,
    fulfilledAt: o.fulfilledAt?.toISOString() ?? null,
    stripePaymentUrl: o.stripePaymentIntentId
      ? `https://dashboard.stripe.com/${test}payments/${o.stripePaymentIntentId}`
      : null,
  };
}

// -------------------------------------------------------------- products ----

export async function merchToShip(): Promise<number> {
  const [r] = await db.select({ n: count() }).from(merchOrders).where(eq(merchOrders.status, 'paid'));
  return r?.n ?? 0;
}

export async function merchOverview(): Promise<{ products: MerchProductDto[]; toShip: number; stripeConfigured: boolean }> {
  const [products, toShip] = await Promise.all([listProducts({ includeInactive: true }), merchToShip()]);
  return { products: products.map(productDto), toShip, stripeConfigured: has.stripe };
}

async function loadProduct(id: string): Promise<MerchProductDto | null> {
  const [p] = await db.select().from(merchProducts).where(eq(merchProducts.id, id));
  if (!p) return null;
  const variants = await db
    .select()
    .from(merchVariants)
    .where(eq(merchVariants.productId, id))
    .orderBy(asc(merchVariants.sortOrder));
  const inStock = (s: number | null) => s === null || s > 0;
  return productDto({
    ...p,
    variants,
    soldOut: variants.length === 0 || variants.every((v) => !inStock(v.stock)),
    fromCents: variants.length ? Math.min(...variants.map((v) => v.priceCents ?? p.priceCents)) : p.priceCents,
  });
}

export async function getProduct(input: unknown): Promise<Result<MerchProductDto>> {
  const parsed = IdSchema.safeParse(input);
  if (!parsed.success) return fail('Product not found.');
  const p = await loadProduct(parsed.data.id);
  return p ? ok(p) : fail('Product not found.');
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/** "28", "28.50", "$28" → cents; "" → null. */
function cents(v: string): number | null | 'bad' {
  const s = v.trim().replace(/[$,]/g, '');
  if (s === '') return null;
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(s)) return 'bad';
  const [d, c = ''] = s.split('.');
  return Number(d) * 100 + Number(c.padEnd(2, '0'));
}

const VariantSchema = z.object({
  id: z.union([z.literal(''), z.string().regex(UUID)]),
  size: z.string().trim().max(30),
  color: z.string().trim().max(40),
  price: z.string().max(16),
  stock: z.string().max(8),
  sku: z.string().trim().max(60),
}) satisfies z.ZodType<MerchVariantInput>;

const ProductSchema = z.object({
  id: z.union([z.literal(''), z.string().regex(UUID)]),
  name: z.string().trim().min(1, 'Name is required').max(80),
  slug: z.string().trim().max(60),
  description: z.string().trim().max(1000),
  price: z.string().max(16),
  fulfillment: z.enum(['self', 'pod']),
  providerRef: z.string().trim().max(120),
  sortOrder: z.coerce.number().int().min(0, 'Sort order is 0–999').max(999, 'Sort order is 0–999'),
  active: z.boolean(),
  variants: z.array(VariantSchema).max(100),
});

/**
 * Create or update a product and its whole variant list (variants missing
 * from the list are deleted). `photo` replaces the current photo.
 */
export async function saveProduct(
  input: unknown,
  photo: File | null,
): Promise<Result<{ product: MerchProductDto; created: boolean }>> {
  const parsed = ProductSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const p = parsed.data;

  const price = cents(p.price);
  if (price === null || price === 'bad' || price <= 0)
    return fail('Price must be like 28 or 28.50.', { price: 'Like 28 or 28.50' });
  const slug = slugify(p.slug || p.name);
  if (!slug) return fail('The link is empty — use letters or numbers.', { slug: 'Use letters or numbers' });

  const rows: Array<{
    id: string;
    size: string | null;
    color: string | null;
    priceCents: number | null;
    stock: number | null;
    sku: string | null;
    sortOrder: number;
  }> = [];
  for (const [i, v] of p.variants.entries()) {
    if (!v.size && !v.color && !v.price.trim() && !v.stock.trim() && !v.sku && !v.id) continue; // blank row
    const vp = cents(v.price);
    if (vp === 'bad') return fail(`Variant ${i + 1}: price must be like 32 or 32.50 (or blank).`, { variants: `Variant ${i + 1}: check the price` });
    if (v.stock.trim() !== '' && !/^\d{1,5}$/.test(v.stock.trim()))
      return fail(`Variant ${i + 1}: stock must be a whole number (or blank for unlimited).`, { variants: `Variant ${i + 1}: check the stock` });
    rows.push({
      id: v.id,
      size: v.size || null,
      color: v.color || null,
      priceCents: vp,
      stock: v.stock.trim() === '' ? null : Number(v.stock.trim()),
      sku: v.sku || null,
      sortOrder: i,
    });
  }
  if (rows.length === 0)
    return fail('Add at least one variant (leave size/color blank for a single-option product).', {
      variants: 'Add at least one variant',
    });

  if (p.id && !(await db.select({ id: merchProducts.id }).from(merchProducts).where(eq(merchProducts.id, p.id)))[0])
    return fail('That product no longer exists.');

  const [clash] = await db.select({ id: merchProducts.id }).from(merchProducts).where(eq(merchProducts.slug, slug)).limit(1);
  if (clash && clash.id !== p.id)
    return fail(`Another product already uses the link /merch/${slug}.`, { slug: 'Already used by another product' });

  let photoUrl: string | undefined;
  if (photo && photo.size > 0) {
    try {
      photoUrl = await storeImage(photo, 'merch');
    } catch (err) {
      return fail(err instanceof UploadError ? err.message : 'Upload failed.', { photo: 'Upload failed' });
    }
  }

  const values = {
    name: p.name,
    slug,
    description: p.description || null,
    priceCents: price,
    fulfillment: p.fulfillment,
    providerRef: p.providerRef || null,
    sortOrder: p.sortOrder,
    active: p.active,
    ...(photoUrl ? { photoUrl } : {}),
  };

  let productId = p.id;
  await db.transaction(async (tx) => {
    if (productId) await tx.update(merchProducts).set(values).where(eq(merchProducts.id, productId));
    else productId = (await tx.insert(merchProducts).values(values).returning({ id: merchProducts.id }))[0]!.id;

    const keep = rows.filter((r) => r.id).map((r) => r.id);
    await tx
      .delete(merchVariants)
      .where(
        keep.length
          ? and(eq(merchVariants.productId, productId), notInArray(merchVariants.id, keep))
          : eq(merchVariants.productId, productId),
      );
    for (const { id: vid, ...r } of rows) {
      if (vid)
        await tx
          .update(merchVariants)
          .set(r)
          .where(and(eq(merchVariants.id, vid), eq(merchVariants.productId, productId)));
      else await tx.insert(merchVariants).values({ ...r, productId });
    }
  });

  refresh();
  return ok({ product: (await loadProduct(productId))!, created: !p.id });
}

const ActiveSchema = z.object({ id: z.string().regex(UUID), active: z.boolean() });

export async function setProductActive(input: unknown): Promise<Result<MerchProductDto>> {
  const parsed = ActiveSchema.safeParse(input);
  if (!parsed.success) return fail('Product not found.');
  const [row] = await db
    .update(merchProducts)
    .set({ active: parsed.data.active })
    .where(eq(merchProducts.id, parsed.data.id))
    .returning({ id: merchProducts.id });
  if (!row) return fail('Product not found.');
  refresh();
  return ok((await loadProduct(row.id))!);
}

const StockSchema = z.object({
  variantId: z.string().regex(UUID),
  stock: z.number().int('Whole numbers only').min(0, 'Can’t be negative').max(99999).nullable(),
});

export async function setVariantStock(input: unknown): Promise<Result<MerchProductDto>> {
  const parsed = StockSchema.safeParse(input);
  if (!parsed.success) return fail('Stock must be a whole number, or blank for unlimited.', { stock: 'Whole number or blank' });
  const [row] = await db
    .update(merchVariants)
    .set({ stock: parsed.data.stock })
    .where(eq(merchVariants.id, parsed.data.variantId))
    .returning({ productId: merchVariants.productId });
  if (!row) return fail('That variant no longer exists.');
  refresh();
  return ok((await loadProduct(row.productId))!);
}

/** Orders copy item names onto their lines, so deleting never breaks history. */
export async function deleteProduct(input: unknown): Promise<Result<{ deleted: true }>> {
  const parsed = IdSchema.safeParse(input);
  if (!parsed.success) return fail('Product not found.');
  const gone = await db.delete(merchProducts).where(eq(merchProducts.id, parsed.data.id)).returning({ id: merchProducts.id });
  if (!gone.length) return fail('Product not found.');
  refresh();
  return ok({ deleted: true });
}

// ---------------------------------------------------------------- orders ----

const ListSchema = z.object({ show: z.enum(['active', 'all']).default('active') });

export async function listOrders(input: unknown): Promise<Result<{ orders: MerchOrderSummaryDto[]; toShip: number }>> {
  const parsed = ListSchema.safeParse(input ?? {});
  if (!parsed.success) return invalid(parsed.error);
  const [orders, toShip] = await Promise.all([
    db
      .select()
      .from(merchOrders)
      .where(parsed.data.show === 'all' ? undefined : inArray(merchOrders.status, ['paid', 'fulfilled']))
      .orderBy(desc(merchOrders.createdAt))
      .limit(200),
    merchToShip(),
  ]);
  return ok({ orders: orders.map(orderSummary), toShip });
}

export async function getOrder(input: unknown): Promise<Result<MerchOrderDto>> {
  const parsed = IdSchema.safeParse(input);
  if (!parsed.success) return fail('Order not found.');
  const [o] = await db.select().from(merchOrders).where(eq(merchOrders.id, parsed.data.id));
  return o ? ok(orderDto(o)) : fail('Order not found.');
}

const FulfillSchema = z.object({
  id: z.string().regex(UUID),
  tracking: z.string().trim().max(80),
  notify: z.boolean(),
});

export async function fulfillOrder(input: unknown): Promise<Result<{ order: MerchOrderDto; emailed: boolean }>> {
  const parsed = FulfillSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, notify } = parsed.data;
  const tracking = parsed.data.tracking || null;
  const [order] = await db
    .update(merchOrders)
    .set({ status: 'fulfilled', fulfilledAt: new Date(), trackingNumber: tracking })
    .where(and(eq(merchOrders.id, id), inArray(merchOrders.status, ['paid', 'fulfilled'])))
    .returning();
  if (!order) return fail('Only paid orders can be marked fulfilled.');
  const emailed = Boolean(order.email && notify);
  if (order.email && notify) {
    const ref = orderRef(order.id);
    await sendEmail({
      to: order.email,
      subject:
        order.delivery === 'pickup'
          ? `Your Barrio order #${ref} is ready at the truck`
          : `Your Barrio order #${ref} shipped`,
      text:
        order.delivery === 'pickup'
          ? `¡Listo! Your merch is waiting at the truck window. Just give your name.\n\n${env.siteUrl}/find-us`
          : `¡Ya va! Your order is on its way.${tracking ? `\n\nTracking: ${tracking}\nhttps://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(tracking)}` : ''}`,
    });
  }
  refresh();
  return ok({ order: orderDto(order), emailed });
}

const OrderStatusSchema = z.object({ id: z.string().regex(UUID), status: z.enum(['cancelled', 'refunded']) });

export async function setOrderStatus(input: unknown): Promise<Result<MerchOrderDto>> {
  const parsed = OrderStatusSchema.safeParse(input);
  if (!parsed.success) return fail('Unknown order or status.');
  const { id, status } = parsed.data;
  // Unpaid orders get cancelled; paid ones (refunded in Stripe) get marked refunded.
  const from = status === 'cancelled' ? (['pending'] as const) : (['paid', 'fulfilled'] as const);
  const [order] = await db
    .update(merchOrders)
    .set({ status })
    .where(and(eq(merchOrders.id, id), inArray(merchOrders.status, [...from])))
    .returning();
  if (!order)
    return fail(status === 'cancelled' ? 'Only unpaid orders can be cancelled.' : 'Only paid orders can be marked refunded.');
  refresh();
  return ok(orderDto(order));
}
