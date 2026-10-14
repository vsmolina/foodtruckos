'use server';

import { revalidatePath } from 'next/cache';
import type { TruckStatus } from '@barrio/site-contract';
import { auth } from '@/auth';
import { siteApi } from '@/lib/site/api';
import { bool, num, str, toFormState, type FormState } from '@/lib/site/form';

// Server actions are reachable by direct POST: each re-checks the dashboard
// session before calling the website. The website validates every input.

async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
}

const STATUSES: readonly TruckStatus[] = ['open', 'back_soon', 'closed'];

export async function setStatus(status: TruckStatus): Promise<FormState> {
  await requireAdmin();
  if (!STATUSES.includes(status)) return { error: 'Unknown status.' };
  const label = { open: 'Open now', back_soon: 'Back soon', closed: 'Closed' }[status];
  const result = await siteApi('status.set', { status });
  revalidatePath('/', 'page'); // Today shows the website status too
  return toFormState(result, `The website now says ${label}.`);
}

export async function setPaused(paused: boolean): Promise<FormState> {
  await requireAdmin();
  const result = await siteApi('status.setPaused', { paused });
  revalidatePath('/', 'page');
  return toFormState(result, paused ? 'Online orders paused.' : 'Online orders back on.');
}

export async function saveMessages(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return toFormState(
    await siteApi('status.saveMessages', {
      statusMessage: str(fd, 'statusMessage', 200),
      pausedMessage: str(fd, 'pausedMessage', 200),
      defaultWaitMinutes: num(fd, 'defaultWaitMinutes'),
    }),
    'Messages saved.',
  );
}

export async function saveLocation(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return toFormState(
    await siteApi('status.saveLocation', {
      locationName: str(fd, 'locationName', 80),
      address: str(fd, 'address', 120),
      lat: str(fd, 'lat', 20),
      lng: str(fd, 'lng', 20),
      lateNightNote: str(fd, 'lateNightNote', 240),
      phone: str(fd, 'phone', 30),
      instagram: str(fd, 'instagram', 31),
    }),
    'Location saved.',
  );
}

export async function saveHours(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const days = Array.from({ length: 7 }, (_, d) => ({
    dayOfWeek: d,
    closed: bool(fd, `closed-${d}`),
    opens: str(fd, `opens-${d}`, 5),
    closes: str(fd, `closes-${d}`, 5),
    note: str(fd, `note-${d}`, 60),
  }));
  return toFormState(await siteApi('status.saveHours', { days }), 'Hours saved.');
}
