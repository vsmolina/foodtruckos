import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { broadcasts, specials, subscribers } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { sendEmail } from '@/lib/messaging/email';
import { sendSms } from '@/lib/messaging/sms';
import { SMS_STOP_SUFFIX, emailActive, smsActive, unsubscribePostUrl, unsubscribeUrl } from '@/lib/subscribers';

export type BroadcastInput = {
  subject: string;
  body: string;
  sendEmail: boolean;
  sendSms: boolean;
  specialId: string | null;
};

export type Rendered = { sms: string; emailSubject: string; emailText: (unsubscribe: string) => string };

/** The exact SMS and email text subscribers will get. */
export async function renderBroadcast(input: BroadcastInput): Promise<Rendered> {
  const special = input.specialId ? (await db.select().from(specials).where(eq(specials.id, input.specialId)))[0] : undefined;
  const link = `${env.siteUrl}/specials`;
  const specialLine = special ? `${special.title}${special.priceLabel ? ` — ${special.priceLabel}` : ''}` : null;
  const sms = `Barrio Burger Co: ${input.body.trim()}${specialLine && !input.body.includes(special!.title) ? ` (${specialLine})` : ''} ${link} ${SMS_STOP_SUFFIX}`;
  return {
    sms,
    emailSubject: input.subject.trim(),
    emailText: (unsubscribe) =>
      [
        input.body.trim(),
        specialLine ? `\n${specialLine}${special?.body ? `\n${special.body}` : ''}` : null,
        `\nMore: ${link}`,
        `\n— Barrio Burger Co., on the Square in San Marcos, TX`,
        `\nYou’re getting this because you signed up for specials. Unsubscribe: ${unsubscribe}`,
      ]
        .filter(Boolean)
        .join('\n'),
  };
}

/** Active, opted-in recipients per channel. */
export async function audience(): Promise<{ email: Array<{ email: string; token: string }>; sms: string[] }> {
  const rows = await db.select().from(subscribers);
  return {
    email: rows.filter(emailActive).map((r) => ({ email: r.email!, token: r.unsubscribeToken })),
    sms: rows.filter(smsActive).map((r) => r.phone!),
  };
}

/** Run `fn` over items with a small concurrency limit (be polite to providers). */
async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<boolean>): Promise<number> {
  let ok = 0;
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++]!;
      if (await fn(item)) ok++;
    }
  });
  await Promise.all(workers);
  return ok;
}

/** Send to every opted-in subscriber and record the broadcast. Returns sent counts. */
export async function sendBroadcast(input: BroadcastInput): Promise<{ id: string; emailCount: number; smsCount: number }> {
  const rendered = await renderBroadcast(input);
  const to = await audience();
  const [row] = await db
    .insert(broadcasts)
    .values({ specialId: input.specialId, subject: input.subject, body: input.body, sendEmail: input.sendEmail, sendSms: input.sendSms })
    .returning({ id: broadcasts.id });

  const emailCount = input.sendEmail
    ? await pool(to.email, 3, (r) =>
        sendEmail({
          to: r.email,
          subject: rendered.emailSubject,
          text: rendered.emailText(unsubscribeUrl(r.token)),
          unsubscribeUrl: unsubscribePostUrl(r.token),
        }),
      )
    : 0;
  const smsCount = input.sendSms ? await pool(to.sms, 2, (phone) => sendSms(phone, rendered.sms)) : 0;

  await db.update(broadcasts).set({ emailCount, smsCount, sentAt: new Date() }).where(eq(broadcasts.id, row!.id));
  return { id: row!.id, emailCount, smsCount };
}
