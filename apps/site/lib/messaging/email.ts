import 'server-only';
import { Resend } from 'resend';
import { db } from '@/lib/db/client';
import { messageLog } from '@/lib/db/schema';
import { has } from '@/lib/env';

let client: Resend | null = null;

export type Email = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  /** One-click unsubscribe URL for marketing mail (RFC 8058). */
  unsubscribeUrl?: string;
};

/** Send one email via Resend; logged instead when Resend isn't configured. Never throws. */
export async function sendEmail(mail: Email): Promise<boolean> {
  const to = Array.isArray(mail.to) ? mail.to : [mail.to];
  if (!has.resend) {
    console.info(`[email:logged] → ${to.join(', ')}: ${mail.subject}\n${mail.text}`);
    await db.insert(messageLog).values({ channel: 'email', to: to.join(', '), subject: mail.subject, body: mail.text, status: 'logged' });
    return true;
  }
  try {
    client ??= new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await client.emails.send({
      from: process.env.EMAIL_FROM!,
      to,
      subject: mail.subject,
      text: mail.text,
      ...(mail.html ? { html: mail.html } : {}),
      ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
      ...(mail.unsubscribeUrl
        ? {
            headers: {
              'List-Unsubscribe': `<${mail.unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          }
        : {}),
    });
    if (error) throw new Error(error.message);
    await db.insert(messageLog).values({
      channel: 'email',
      to: to.join(', '),
      subject: mail.subject,
      body: mail.text,
      status: 'sent',
      providerId: data?.id ?? null,
    });
    return true;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[email] failed:', error);
    await db.insert(messageLog).values({ channel: 'email', to: to.join(', '), subject: mail.subject, body: mail.text, status: 'failed', error });
    return false;
  }
}

/** Where owner alerts go (catering leads, takedown requests, failed orders). */
export function ownerContacts(): { email: string | null; phone: string | null } {
  return { email: process.env.OWNER_EMAIL || null, phone: process.env.OWNER_PHONE || null };
}
