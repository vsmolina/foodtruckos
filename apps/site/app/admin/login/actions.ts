'use server';

import { redirect } from 'next/navigation';
import { checkPassword, endSession, startSession } from '@/lib/auth';
import { rateLimit, rateLimitCount } from '@/lib/rate-limit';

export type LoginState = { error?: string };

export async function signIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  // Only wrong passwords count toward the limit (8 per 15 minutes).
  if ((await rateLimitCount('admin-login-fail', 15 * 60)) >= 8) return { error: 'Too many wrong tries. Wait 15 minutes.' };
  const password = String(form.get('password') ?? '');
  if (!(await checkPassword(password))) {
    await rateLimit('admin-login-fail', 8, 15 * 60);
    return { error: 'Wrong password.' };
  }
  await startSession();
  redirect('/admin');
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect('/admin/login');
}
