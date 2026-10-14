'use server';

import { cookies } from 'next/headers';

export async function toggleTheme(): Promise<void> {
  const jar = await cookies();
  const next = jar.get('theme')?.value === 'light' ? 'dark' : 'light';
  jar.set('theme', next, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
}
