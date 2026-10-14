'use server';

import { redirect } from 'next/navigation';
import * as merch from '@/lib/admin/merch';
import { requireAdmin } from '@/lib/auth';

// Thin wrappers: the logic lives in lib/admin/merch.ts, shared with the admin
// API that the truck dashboard calls.

export type FormState = { error?: string; ok?: string };

export async function saveProduct(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(form.get('id') ?? '');
  // Variants arrive as parallel arrays (one row per variant in the editor).
  const col = (name: string) => form.getAll(name).map(String);
  const [sizes, colors, prices, stocks, skus] = ['v_size', 'v_color', 'v_price', 'v_stock', 'v_sku'].map(col);
  const variants = col('v_id').map((vid, i) => ({
    id: vid,
    size: sizes![i] ?? '',
    color: colors![i] ?? '',
    price: prices![i] ?? '',
    stock: stocks![i] ?? '',
    sku: skus![i] ?? '',
  }));
  const photo = form.get('photo');
  const result = await merch.saveProduct(
    {
      id,
      name: String(form.get('name') ?? ''),
      slug: String(form.get('slug') ?? ''),
      description: String(form.get('description') ?? ''),
      price: String(form.get('price') ?? ''),
      fulfillment: form.get('fulfillment'),
      providerRef: String(form.get('providerRef') ?? ''),
      sortOrder: form.get('sortOrder') || 0,
      active: form.get('active') === 'on',
      variants,
    },
    photo instanceof File ? photo : null,
  );
  if (!result.ok) return { error: result.error };
  if (result.data.created) redirect(`/admin/merch/products/${result.data.product.id}?saved=1`);
  return { ok: 'Saved.' };
}

export async function toggleProductActive(form: FormData): Promise<void> {
  await requireAdmin();
  await merch.setProductActive({ id: String(form.get('id')), active: form.get('active') === '1' });
}

export async function deleteProduct(form: FormData): Promise<void> {
  await requireAdmin();
  if (form.get('confirm') !== 'yes') return;
  await merch.deleteProduct({ id: String(form.get('id')) });
  redirect('/admin/merch');
}

export async function markFulfilled(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const result = await merch.fulfillOrder({
    id: String(form.get('id')),
    tracking: String(form.get('tracking') ?? '').slice(0, 80),
    notify: form.get('notify') === 'on',
  });
  if (!result.ok) return { error: result.error };
  return { ok: result.data.emailed ? 'Marked fulfilled and emailed the customer.' : 'Marked fulfilled.' };
}

export async function setOrderStatus(form: FormData): Promise<void> {
  await requireAdmin();
  const status = form.get('status');
  if (status !== 'cancelled' && status !== 'refunded') return;
  await merch.setOrderStatus({ id: String(form.get('id')), status });
}
