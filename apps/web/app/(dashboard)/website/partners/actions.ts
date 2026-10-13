'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { PartnerKind } from '@barrio/site-contract';
import { auth } from '@/auth';
import { siteApi } from '@/lib/site/api';
import { bool, file, num, str, toFormState, type FormState } from '@/lib/site/form';

// Partners (bars, bartenders) and their referral codes. Each action re-checks
// the dashboard session; the website validates every input.

async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
}

const KINDS: readonly PartnerKind[] = ['bar', 'bartender', 'other'];

/** Create (id null) or update. A new partner opens its page; edits stay put. */
export async function savePartner(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const kind = str(fd, 'kind', 20) as PartnerKind;
  const sortOrder = num(fd, 'sortOrder');
  const result = await siteApi(
    'partners.save',
    {
      id,
      name: str(fd, 'name', 80),
      kind: KINDS.includes(kind) ? kind : 'bar',
      code: str(fd, 'code', 16),
      blurb: str(fd, 'blurb', 280),
      instagram: str(fd, 'instagram', 60),
      url: str(fd, 'url', 300),
      sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
      active: bool(fd, 'active'),
    },
    { photo: file(fd, 'photo') },
  );
  if (result.ok && !id) {
    revalidatePath('/website', 'layout');
    redirect(`/website/partners/${result.data.id}?created=1`);
  }
  return toFormState(result, 'Partner saved.');
}

/** The Photo panel disappears on success, so report it at page level via a redirect. */
export async function removePhoto(id: string): Promise<FormState> {
  await requireAdmin();
  const result = await siteApi('partners.removePhoto', { id });
  if (!result.ok) return toFormState(result, '');
  revalidatePath('/website', 'layout');
  redirect(`/website/partners/${id}?photo=removed`);
}

export async function deletePartner(id: string): Promise<void> {
  await requireAdmin();
  const result = await siteApi('partners.delete', { id });
  revalidatePath('/website', 'layout');
  redirect(result.ok ? '/website/partners?deleted=1' : `/website/partners/${id}?error=delete`);
}
