'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { setOrderStatus } from '@/lib/orders/status';

const schema = z.object({
  id: z.uuid(),
  status: z.enum(['preparing', 'ready', 'picked_up', 'cancelled']),
});

/** Manual override (mock mode, or when the KDS link is down). "Ready" texts the customer once. */
export async function setStatusAction(form: FormData): Promise<void> {
  await requireAdmin();
  const parsed = schema.safeParse({ id: form.get('id'), status: form.get('status') });
  if (!parsed.success) return;
  await setOrderStatus(parsed.data.id, parsed.data.status);
  revalidatePath('/admin/orders');
}
