'use server';

import { redirect } from 'next/navigation';
import type { MerchVariantInput } from '@barrio/site-contract';
import { auth } from '@/auth';
import { siteApi } from '@/lib/site/api';
import { bool, file, num, str, toFormState, type FormState } from '@/lib/site/form';

// Merch tab → the website's merch.* admin ops. Server actions are reachable by
// direct POST, so each re-checks the dashboard session; the website validates
// every input.

async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
}

/** Create (no id) or update a product with its variant rows and optional photo. */
export async function saveProduct(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const id = str(fd, 'id', 40);
  const col = (name: string) => fd.getAll(name).map((v) => (typeof v === 'string' ? v.trim() : ''));
  const [sizes, colors, prices, stocks, skus] = ['v_size', 'v_color', 'v_price', 'v_stock', 'v_sku'].map(col);
  const variants: MerchVariantInput[] = col('v_id').map((vid, i) => ({
    id: vid,
    size: (sizes![i] ?? '').slice(0, 30),
    color: (colors![i] ?? '').slice(0, 40),
    price: (prices![i] ?? '').slice(0, 16),
    stock: (stocks![i] ?? '').slice(0, 8),
    sku: (skus![i] ?? '').slice(0, 60),
  }));
  const sortOrder = num(fd, 'sortOrder');
  const result = await siteApi(
    'merch.saveProduct',
    {
      id,
      name: str(fd, 'name', 80),
      slug: str(fd, 'slug', 60),
      description: str(fd, 'description', 1000),
      price: str(fd, 'price', 16),
      fulfillment: str(fd, 'fulfillment', 8) === 'pod' ? 'pod' : 'self',
      providerRef: str(fd, 'providerRef', 120),
      sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
      active: bool(fd, 'active'),
      variants,
    },
    { photo: file(fd, 'photo') },
  );
  // Redirect on success so the editor reloads with the saved variant ids.
  if (result.ok) redirect(`/website/merch/products/${result.data.product.id}?notice=${result.data.created ? 'created' : 'saved'}`);
  return toFormState(result, '');
}

export async function setActive(id: string, active: boolean): Promise<FormState> {
  await requireAdmin();
  return toFormState(await siteApi('merch.setActive', { id, active }), active ? 'Live on the website.' : 'Hidden from the website.');
}

export async function setStock(variantId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const raw = str(fd, 'stock', 8);
  const stock = raw === '' ? null : Number(raw);
  if (stock !== null && !Number.isInteger(stock)) return { error: 'Whole number, or blank for unlimited.', at: Date.now() };
  return toFormState(await siteApi('merch.setStock', { variantId, stock }), 'Stock updated.');
}

export async function deleteProduct(id: string): Promise<void> {
  await requireAdmin();
  const result = await siteApi('merch.deleteProduct', { id });
  redirect(result.ok ? '/website/merch?notice=deleted' : `/website/merch/products/${id}?notice=err_delete`);
}

export async function fulfillOrder(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const result = await siteApi('merch.fulfill', { id, tracking: str(fd, 'tracking', 80), notify: bool(fd, 'notify') });
  return toFormState(result, result.ok && result.data.emailed ? 'Marked fulfilled and emailed the customer.' : 'Marked fulfilled.');
}

export async function setOrderStatus(id: string, status: 'cancelled' | 'refunded'): Promise<FormState> {
  await requireAdmin();
  return toFormState(
    await siteApi('merch.setOrderStatus', { id, status }),
    status === 'cancelled' ? 'Marked cancelled.' : 'Marked refunded.',
  );
}
