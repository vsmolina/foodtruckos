'use server';

import type { MenuItemFlag } from '@barrio/site-contract';
import { auth } from '@/auth';
import { siteApi } from '@/lib/site/api';
import { bool, file, num, str, toFormState, type FormState } from '@/lib/site/form';

// Website-only menu fields, edited through the site's admin API. Every action
// re-checks the dashboard session (server actions are reachable by direct POST);
// the website validates every input.

async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
}

const FLAGS: readonly MenuItemFlag[] = ['soldOut', 'hidden', 'isNew'];
const FLAG_TEXT: Record<MenuItemFlag, [on: string, off: string]> = {
  soldOut: ['Marked sold out on the website.', 'Back on sale on the website.'],
  hidden: ['Hidden from the website.', 'Showing on the website.'],
  isNew: ['Marked NEW.', 'NEW sticker removed.'],
};

export async function syncFromSquare(): Promise<FormState> {
  await requireAdmin();
  const r = await siteApi('menu.sync', {});
  if (!r.ok) return toFormState(r, '');
  const { items, categories, removed } = r.data;
  return toFormState(
    r,
    `Synced ${items} items in ${categories} categories from Square${removed ? `; ${removed} no longer in Square were hidden` : ''}.`,
  );
}

export async function setItemFlag(id: string, flag: MenuItemFlag, value: boolean): Promise<FormState> {
  await requireAdmin();
  if (!FLAGS.includes(flag)) return { error: 'Unknown setting.' };
  return toFormState(await siteApi('menu.setItemFlag', { id, flag, value }), FLAG_TEXT[flag][value ? 0 : 1]);
}

export async function saveItem(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return toFormState(
    await siteApi(
      'menu.saveItem',
      { id, taglineEs: str(fd, 'taglineEs', 60), sortOrder: num(fd, 'sortOrder'), removePhoto: bool(fd, 'removePhoto') },
      { photo: file(fd, 'photo') },
    ),
    'Saved.',
  );
}

export async function saveCategory(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return toFormState(
    await siteApi('menu.saveCategory', { id, labelEs: str(fd, 'labelEs', 40), sortOrder: num(fd, 'sortOrder') }),
    'Category saved.',
  );
}

export async function setCategoryHidden(id: string, hidden: boolean): Promise<FormState> {
  await requireAdmin();
  return toFormState(
    await siteApi('menu.setCategoryHidden', { id, hidden }),
    hidden ? 'Category hidden from the website.' : 'Category showing on the website.',
  );
}
