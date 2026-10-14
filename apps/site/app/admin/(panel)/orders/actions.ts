'use server';

import { overrideOrderStatus } from '@/lib/admin/insights';
import { requireAdmin } from '@/lib/auth';

/** Manual override (mock mode, or when the KDS link is down). "Ready" texts the customer once. */
export async function setStatusAction(form: FormData): Promise<void> {
  await requireAdmin();
  await overrideOrderStatus({ id: form.get('id'), status: form.get('status') });
}
