'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { LEAD_STAGES } from '@/lib/catering';
import { db } from '@/lib/db/client';
import { cateringLeads } from '@/lib/db/schema';

const updateSchema = z.object({
  id: z.uuid(),
  status: z.enum(LEAD_STAGES),
  adminNotes: z.string().max(5000).optional(),
});

export async function updateLead(form: FormData): Promise<void> {
  await requireAdmin();
  const parsed = updateSchema.parse({
    id: form.get('id'),
    status: form.get('status'),
    adminNotes: form.get('adminNotes') ?? undefined,
  });
  await db
    .update(cateringLeads)
    .set({ status: parsed.status, ...(parsed.adminNotes !== undefined ? { adminNotes: parsed.adminNotes.trim() || null } : {}) })
    .where(eq(cateringLeads.id, parsed.id));
  revalidatePath('/admin/catering');
  revalidatePath(`/admin/catering/${parsed.id}`);
}
