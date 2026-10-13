'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { audience, renderBroadcast, sendBroadcast, type BroadcastInput } from '@/lib/broadcast';

export type BroadcastState =
  | { step: 'compose'; error?: string; values?: Record<string, string | boolean> }
  | {
      step: 'preview';
      values: Record<string, string | boolean>;
      sms: string;
      emailSubject: string;
      emailText: string;
      emailRecipients: number;
      smsRecipients: number;
    }
  | { step: 'sent'; emailCount: number; smsCount: number };

const schema = z
  .object({
    subject: z.string().trim().max(150),
    body: z.string().trim().min(5, 'Write the message.').max(600, 'Keep it under 600 characters.'),
    sendEmail: z.boolean(),
    sendSms: z.boolean(),
    specialId: z.union([z.uuid(), z.literal('')]),
  })
  .refine((v) => v.sendEmail || v.sendSms, { message: 'Pick email, text, or both.' })
  .refine((v) => !v.sendEmail || v.subject.length >= 3, { message: 'Emails need a subject.' });

function read(form: FormData): Record<string, string | boolean> {
  return {
    subject: String(form.get('subject') ?? ''),
    body: String(form.get('body') ?? ''),
    sendEmail: form.get('sendEmail') === 'yes',
    sendSms: form.get('sendSms') === 'yes',
    specialId: String(form.get('specialId') ?? ''),
  };
}

export async function broadcastAction(_prev: BroadcastState, form: FormData): Promise<BroadcastState> {
  await requireAdmin();
  const values = read(form);
  const intent = String(form.get('intent') ?? 'preview');
  if (intent === 'edit') return { step: 'compose', values };

  const parsed = schema.safeParse(values);
  if (!parsed.success) return { step: 'compose', error: parsed.error.issues[0]?.message ?? 'Check the form.', values };
  const input: BroadcastInput = { ...parsed.data, specialId: parsed.data.specialId || null };

  if (intent === 'send') {
    const res = await sendBroadcast(input);
    revalidatePath('/admin/subscribers');
    return { step: 'sent', emailCount: res.emailCount, smsCount: res.smsCount };
  }

  const [rendered, to] = await Promise.all([renderBroadcast(input), audience()]);
  return {
    step: 'preview',
    values,
    sms: rendered.sms,
    emailSubject: rendered.emailSubject,
    emailText: rendered.emailText('https://…/unsubscribe/(their link)'),
    emailRecipients: input.sendEmail ? to.email.length : 0,
    smsRecipients: input.sendSms ? to.sms.length : 0,
  };
}
