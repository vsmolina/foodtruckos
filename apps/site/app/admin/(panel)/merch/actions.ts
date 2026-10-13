'use server';

import { and, eq, inArray, notInArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { merchOrders, merchProducts, merchVariants } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { sendEmail } from '@/lib/messaging/email';
import { UploadError, storeImage } from '@/lib/storage';

export type FormState = { error?: string; ok?: string };

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/** "28", "28.50", "$28" → cents; "" → null. */
function cents(v: FormDataEntryValue | null): number | null | 'bad' {
  const s = String(v ?? '')
    .trim()
    .replace(/[$,]/g, '');
  if (s === '') return null;
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(s)) return 'bad';
  const [d, c = ''] = s.split('.');
  return Number(d) * 100 + Number(c.padEnd(2, '0'));
}

const Product = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  slug: z.string().trim().max(60),
  description: z.string().trim().max(1000),
  fulfillment: z.enum(['self', 'pod']),
  providerRef: z.string().trim().max(120),
  sortOrder: z.coerce.number().int().min(0).max(999),
  active: z.boolean(),
});

const Variant = z.object({
  id: z.string(),
  size: z.string().trim().max(30),
  color: z.string().trim().max(40),
  price: z.string(),
  stock: z.string(),
  sku: z.string().trim().max(60),
});

export async function saveProduct(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(form.get('id') ?? '');
  const parsed = Product.safeParse({
    name: form.get('name'),
    slug: form.get('slug') ?? '',
    description: form.get('description') ?? '',
    fulfillment: form.get('fulfillment'),
    providerRef: form.get('providerRef') ?? '',
    sortOrder: form.get('sortOrder') || 0,
    active: form.get('active') === 'on',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the fields.' };
  const p = parsed.data;
  const price = cents(form.get('price'));
  if (price === null || price === 'bad' || price <= 0)
    return { error: 'Price must be like 28 or 28.50.' };
  const slug = slugify(p.slug || p.name);
  if (!slug) return { error: 'Slug is empty.' };

  // Variants arrive as parallel arrays (one row per variant in the editor).
  const ids = form.getAll('v_id').map(String);
  const variants = ids.map((vid, i) =>
    Variant.parse({
      id: vid,
      size: String(form.getAll('v_size')[i] ?? ''),
      color: String(form.getAll('v_color')[i] ?? ''),
      price: String(form.getAll('v_price')[i] ?? ''),
      stock: String(form.getAll('v_stock')[i] ?? ''),
      sku: String(form.getAll('v_sku')[i] ?? ''),
    }),
  );
  const rows: Array<{
    id: string;
    size: string | null;
    color: string | null;
    priceCents: number | null;
    stock: number | null;
    sku: string | null;
    sortOrder: number;
  }> = [];
  for (const [i, v] of variants.entries()) {
    if (!v.size && !v.color && !v.price && !v.stock && !v.sku && !v.id) continue; // blank row
    const vp = cents(v.price);
    if (vp === 'bad')
      return { error: `Variant ${i + 1}: price must be like 32 or 32.50 (or blank).` };
    if (v.stock !== '' && !/^\d{1,5}$/.test(v.stock.trim()))
      return { error: `Variant ${i + 1}: stock must be a whole number (or blank for unlimited).` };
    rows.push({
      id: v.id,
      size: v.size || null,
      color: v.color || null,
      priceCents: vp,
      stock: v.stock.trim() === '' ? null : Number(v.stock),
      sku: v.sku || null,
      sortOrder: i,
    });
  }
  if (rows.length === 0)
    return {
      error: 'Add at least one variant (leave size/color blank for a single-option product).',
    };

  let photoUrl: string | undefined;
  const photo = form.get('photo');
  if (photo instanceof File && photo.size > 0) {
    try {
      photoUrl = await storeImage(photo, 'merch');
    } catch (err) {
      return { error: err instanceof UploadError ? err.message : 'Upload failed.' };
    }
  }

  const clash = await db
    .select({ id: merchProducts.id })
    .from(merchProducts)
    .where(eq(merchProducts.slug, slug))
    .limit(1);
  if (clash[0] && clash[0].id !== id)
    return { error: `Another product already uses the link /merch/${slug}.` };

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

  let productId = id;
  await db.transaction(async (tx) => {
    if (id) await tx.update(merchProducts).set(values).where(eq(merchProducts.id, id));
    else
      productId = (
        await tx.insert(merchProducts).values(values).returning({ id: merchProducts.id })
      )[0]!.id;

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

  revalidatePath('/merch');
  revalidatePath('/admin/merch');
  if (!id) redirect(`/admin/merch/products/${productId}?saved=1`);
  return { ok: 'Saved.' };
}

export async function toggleProductActive(form: FormData): Promise<void> {
  await requireAdmin();
  const id = String(form.get('id'));
  const active = form.get('active') === '1';
  await db.update(merchProducts).set({ active }).where(eq(merchProducts.id, id));
  revalidatePath('/admin/merch');
  revalidatePath('/merch');
}

export async function deleteProduct(form: FormData): Promise<void> {
  await requireAdmin();
  if (form.get('confirm') !== 'yes') return;
  await db.delete(merchProducts).where(eq(merchProducts.id, String(form.get('id'))));
  revalidatePath('/admin/merch');
  revalidatePath('/merch');
  redirect('/admin/merch');
}

export async function markFulfilled(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(form.get('id'));
  const tracking =
    String(form.get('tracking') ?? '')
      .trim()
      .slice(0, 80) || null;
  const [order] = await db
    .update(merchOrders)
    .set({ status: 'fulfilled', fulfilledAt: new Date(), trackingNumber: tracking })
    .where(and(eq(merchOrders.id, id), inArray(merchOrders.status, ['paid', 'fulfilled'])))
    .returning();
  if (!order) return { error: 'Only paid orders can be marked fulfilled.' };
  if (order.email && form.get('notify') === 'on') {
    const ref = order.id.slice(-6).toUpperCase();
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
  revalidatePath(`/admin/merch/orders/${id}`);
  revalidatePath('/admin/merch/orders');
  return {
    ok:
      order.email && form.get('notify') === 'on'
        ? 'Marked fulfilled and emailed the customer.'
        : 'Marked fulfilled.',
  };
}

export async function setOrderStatus(form: FormData): Promise<void> {
  await requireAdmin();
  const id = String(form.get('id'));
  const status = z.enum(['cancelled', 'refunded']).parse(form.get('status'));
  await db.update(merchOrders).set({ status }).where(eq(merchOrders.id, id));
  revalidatePath(`/admin/merch/orders/${id}`);
}
