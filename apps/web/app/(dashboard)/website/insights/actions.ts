'use server';

import type { WebOrderOverride } from '@barrio/site-contract';
import { auth } from '@/auth';
import { siteApi } from '@/lib/site/api';
import { toFormState, type FormState } from '@/lib/site/form';

async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
}

const OVERRIDES: readonly WebOrderOverride[] = ['preparing', 'ready', 'picked_up', 'cancelled'];
const DONE: Record<WebOrderOverride, string> = {
  preparing: 'Marked preparing.',
  ready: 'Marked ready — the customer gets a text if they opted in.',
  picked_up: 'Marked picked up.',
  cancelled: 'Cancelled. Refund it in the Square Dashboard.',
};

/** Manual override: normally the kitchen screen moves web orders on its own. */
export async function setOrderStatus(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const status = fd.get('status');
  if (typeof status !== 'string' || !(OVERRIDES as readonly string[]).includes(status)) return { error: 'Unknown status.', at: Date.now() };
  const s = status as WebOrderOverride;
  return toFormState(await siteApi('insights.setOrderStatus', { id, status: s }), DONE[s]);
}
