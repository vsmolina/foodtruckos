'use server';

import * as status from '@/lib/admin/status';
import type { Result } from '@/lib/admin/result';
import { requireAdmin } from '@/lib/auth';

// Thin wrappers: the logic lives in lib/admin/status.ts, shared with the admin
// API that the truck dashboard calls.

export type ActionState = { ok?: string; error?: string; fieldErrors?: Record<string, string> };

function toState(result: Result<unknown>, okText: string): ActionState {
  if (result.ok) return { ok: okText };
  return result.fieldErrors ? { error: result.error, fieldErrors: result.fieldErrors } : { error: result.error };
}

/** One-tap status switch from the big buttons. */
export async function setStatus(value: 'open' | 'closed' | 'back_soon'): Promise<void> {
  await requireAdmin();
  await status.setStatus({ status: value });
}

export async function setOrderingPaused(paused: boolean): Promise<void> {
  await requireAdmin();
  await status.setOrderingPaused({ paused });
}

export async function saveMessages(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  return toState(await status.saveMessages(Object.fromEntries(form)), 'Saved.');
}

export async function saveLocation(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  return toState(await status.saveLocation(Object.fromEntries(form)), 'Saved.');
}

export async function saveHours(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const days = Array.from({ length: 7 }, (_, d) => ({
    dayOfWeek: d,
    closed: form.get(`closed-${d}`) === 'on',
    opens: String(form.get(`opens-${d}`) ?? ''),
    closes: String(form.get(`closes-${d}`) ?? ''),
    note: String(form.get(`note-${d}`) ?? '').slice(0, 60),
  }));
  return toState(await status.saveHours({ days }), 'Hours saved.');
}
