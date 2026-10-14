'use server';

import { updateLead as update } from '@/lib/admin/catering';
import { requireAdmin } from '@/lib/auth';

// Thin wrapper: the logic lives in lib/admin/catering.ts, shared with the admin
// API that the truck dashboard calls.

export async function updateLead(form: FormData): Promise<void> {
  await requireAdmin();
  const adminNotes = form.get('adminNotes');
  const result = await update({
    id: form.get('id'),
    status: form.get('status'),
    ...(typeof adminNotes === 'string' ? { adminNotes } : {}),
  });
  if (!result.ok) throw new Error(result.error);
}
