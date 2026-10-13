'use server';

import { revalidatePath } from 'next/cache';
import type { BroadcastInput, BroadcastPreview, FieldErrors } from '@barrio/site-contract';
import { auth } from '@/auth';
import { siteApi } from '@/lib/site/api';
import { bool, str } from '@/lib/site/form';

// Broadcast composer: compose → preview (exact text + recipient count) → send.
// Sending happens only from the preview step, so it's always a deliberate
// second click. The website sends to opted-in subscribers only.

async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
}

export type ComposerValues = { subject: string; body: string; sendEmail: boolean; sendSms: boolean; specialId: string };

export type ComposerState =
  | { step: 'compose'; values?: ComposerValues; error?: string; fieldErrors?: FieldErrors }
  | { step: 'preview'; values: ComposerValues; preview: BroadcastPreview }
  | { step: 'sent'; emailCount: number; smsCount: number };

function read(fd: FormData): ComposerValues {
  return {
    subject: str(fd, 'subject', 150),
    body: str(fd, 'body', 600),
    sendEmail: bool(fd, 'sendEmail'),
    sendSms: bool(fd, 'sendSms'),
    specialId: str(fd, 'specialId', 40),
  };
}

const toInput = (v: ComposerValues): BroadcastInput => ({ ...v, specialId: v.specialId || null });

export async function broadcastAction(_prev: ComposerState, fd: FormData): Promise<ComposerState> {
  await requireAdmin();
  const values = read(fd);
  const intent = str(fd, 'intent', 10);
  if (intent === 'edit' || intent === 'new') return { step: 'compose', ...(intent === 'edit' ? { values } : {}) };

  if (intent === 'send') {
    const res = await siteApi('subscribers.sendBroadcast', toInput(values));
    if (!res.ok) return { step: 'compose', values, error: res.error, ...(res.fieldErrors ? { fieldErrors: res.fieldErrors } : {}) };
    revalidatePath('/website/subscribers');
    return { step: 'sent', emailCount: res.data.emailCount, smsCount: res.data.smsCount };
  }

  const res = await siteApi('subscribers.previewBroadcast', toInput(values));
  if (!res.ok) return { step: 'compose', values, error: res.error, ...(res.fieldErrors ? { fieldErrors: res.fieldErrors } : {}) };
  return { step: 'preview', values, preview: res.data };
}
