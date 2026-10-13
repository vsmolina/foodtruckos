'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { siteApi } from '@/lib/site/api';
import { bool, file, num, str, toFormState, type FormState } from '@/lib/site/form';

// Specials, edited through the website's admin API. Each action re-checks the
// dashboard session; the website validates every input (times are
// datetime-local strings in San Marcos time).

async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
}

const LIST = '/website/specials';

export async function saveSpecial(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const result = await siteApi(
    'specials.save',
    {
      id,
      title: str(fd, 'title', 80),
      kicker: str(fd, 'kicker', 24),
      body: str(fd, 'body', 400),
      priceLabel: str(fd, 'priceLabel', 12),
      startsAt: str(fd, 'startsAt', 16),
      endsAt: str(fd, 'endsAt', 16),
      sortOrder: num(fd, 'sortOrder'),
      active: bool(fd, 'active'),
      removePhoto: bool(fd, 'removePhoto'),
    },
    { photo: file(fd, 'photo') },
  );
  const state = toFormState(result, 'Special saved.');
  // A new special gets its own page; edits stay put with the "Saved" banner.
  if (result.ok && !id) redirect(`${LIST}/${result.data.id}?created=1`);
  return state;
}

export async function setSpecialActive(id: string, active: boolean): Promise<FormState> {
  await requireAdmin();
  return toFormState(await siteApi('specials.setActive', { id, active }), active ? 'Special is on.' : 'Special is off.');
}

export async function deleteSpecial(id: string): Promise<void> {
  await requireAdmin();
  const result = await siteApi('specials.delete', { id });
  if (!result.ok) redirect(`${LIST}/${id}?error=delete`);
  toFormState(result, ''); // revalidates the Website tabs
  redirect(`${LIST}?deleted=1`);
}
