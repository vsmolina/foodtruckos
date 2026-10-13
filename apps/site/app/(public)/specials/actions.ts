'use server';

import { z } from 'zod';
import { toE164 } from '@/lib/format';
import { sendEmail } from '@/lib/messaging/email';
import { sendSms } from '@/lib/messaging/sms';
import { isBot, rateLimit } from '@/lib/rate-limit';
import { SMS_WELCOME, recordSignup, unsubscribePostUrl, unsubscribeUrl } from '@/lib/subscribers';

export type SignupState =
  | { status: 'idle' }
  | { status: 'error'; attempt: number; message: string; fieldErrors: Record<string, string>; values: Record<string, string> }
  | { status: 'success'; email: boolean; sms: boolean };

const schema = z
  .object({
    email: z.string().trim().toLowerCase().max(200),
    phone: z.string().trim().max(30),
    emailConsent: z.boolean(),
    smsConsent: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.email && !z.email().safeParse(v.email).success) ctx.addIssue({ code: 'custom', path: ['email'], message: 'Enter a valid email address.' });
    if (v.phone && !toE164(v.phone)) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter a 10-digit US mobile number.' });
    if (v.email && !v.emailConsent) ctx.addIssue({ code: 'custom', path: ['emailConsent'], message: 'Check the box to get emails — or clear the email field.' });
    if (v.phone && !v.smsConsent) ctx.addIssue({ code: 'custom', path: ['smsConsent'], message: 'Check the box to get texts — or clear the phone field.' });
    if (v.emailConsent && !v.email) ctx.addIssue({ code: 'custom', path: ['email'], message: 'Add your email to get emails.' });
    if (v.smsConsent && !v.phone) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Add your mobile number to get texts.' });
    if (!v.email && !v.phone && !v.emailConsent && !v.smsConsent)
      ctx.addIssue({ code: 'custom', path: ['form'], message: 'Add an email, a mobile number, or both.' });
  });

export async function signUp(prev: SignupState, form: FormData): Promise<SignupState> {
  const attempt = prev.status === 'error' ? prev.attempt + 1 : 1;
  const values = { email: String(form.get('email') ?? ''), phone: String(form.get('phone') ?? '') };
  if (isBot(form)) return { status: 'success', email: Boolean(values.email), sms: Boolean(values.phone) };

  const parsed = schema.safeParse({
    ...values,
    emailConsent: form.get('emailConsent') === 'yes',
    smsConsent: form.get('smsConsent') === 'yes',
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? 'form')] ??= i.message;
    return { status: 'error', attempt, message: fieldErrors.form ?? 'Check the highlighted fields.', fieldErrors, values };
  }
  if (!(await rateLimit('signup', 6, 60 * 60))) {
    return { status: 'error', attempt, message: 'Too many signups from this connection. Try again later.', fieldErrors: {}, values };
  }

  const email = parsed.data.email || null;
  const phone = parsed.data.phone ? toE164(parsed.data.phone) : null;
  const result = await recordSignup({ email, phone, source: 'specials_page' });

  if (result.smsNew && phone) await sendSms(phone, SMS_WELCOME);
  if (result.emailNew && email && result.token) {
    const unsub = unsubscribeUrl(result.token);
    await sendEmail({
      to: email,
      subject: '¡Bienvenido! You’re on the Barrio Burger Co. list',
      text: `You’re in. We’ll email you specials, new items, and the nights we’re out on the Square — not often, and never spam.\n\nUnsubscribe anytime: ${unsub}\n\n— Barrio Burger Co., San Marcos TX`,
      unsubscribeUrl: unsubscribePostUrl(result.token),
    });
  }
  return { status: 'success', email: Boolean(email), sms: Boolean(phone) };
}
