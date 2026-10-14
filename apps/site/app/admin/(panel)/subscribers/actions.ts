'use server';

import { previewBroadcast, sendBroadcast } from '@/lib/admin/subscribers';
import { requireAdmin } from '@/lib/auth';

// Thin wrapper: the logic lives in lib/admin/subscribers.ts, shared with the
// admin API that the truck dashboard calls.

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

function read(form: FormData) {
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

  if (intent === 'send') {
    const res = await sendBroadcast(values);
    if (!res.ok) return { step: 'compose', error: res.error, values };
    return { step: 'sent', emailCount: res.data.emailCount, smsCount: res.data.smsCount };
  }

  const res = await previewBroadcast(values);
  if (!res.ok) return { step: 'compose', error: res.error, values };
  const { sms, emailSubject, emailText, emailRecipients, smsRecipients } = res.data;
  return { step: 'preview', values, sms, emailSubject, emailText, emailRecipients, smsRecipients };
}
