'use server';

import { auth } from '@/auth';
import { siteApi } from '@/lib/site/api';
import { str, toFormState, type FormState } from '@/lib/site/form';
import { isStage } from './shared';

async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
}

export async function updateLead(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const status = fd.get('status');
  if (!isStage(status)) return { error: 'Pick a stage.', at: Date.now() };
  return toFormState(await siteApi('catering.update', { id, status, adminNotes: str(fd, 'adminNotes', 5000) }), 'Lead saved.');
}
