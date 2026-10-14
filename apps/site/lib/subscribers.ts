import 'server-only';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { subscribers } from '@/lib/db/schema';
import { env } from '@/lib/env';

// Consent language. The exact text shown is stored with each subscriber, so
// change these only together with the signup page (and keep old records as-is).
export const EMAIL_CONSENT = 'Email me specials and news from Barrio Burger Co. Unsubscribe anytime.';
export const SMS_CONSENT =
  'Text me specials and updates from Barrio Burger Co. (recurring automated marketing messages, up to ~4/month) at the number above. Consent is not a condition of purchase. Msg & data rates may apply. Reply STOP to cancel, HELP for help. See Terms & Privacy.';
export const SMS_WELCOME =
  "Barrio Burger Co: you're in! Specials & updates, up to 4 msgs/mo. Msg&data rates may apply. Reply HELP for help, STOP to cancel.";
export const SMS_STOP_SUFFIX = 'Reply STOP to opt out';

export type Subscriber = typeof subscribers.$inferSelect;

export function newToken(): string {
  return randomBytes(18).toString('base64url');
}

/** Human link in the email body: a page with one "Unsubscribe" button (GET never unsubscribes, so link scanners can't). */
export function unsubscribeUrl(token: string): string {
  return `${env.siteUrl}/unsubscribe/${token}`;
}

/** RFC 8058 one-click endpoint for the List-Unsubscribe header (mail apps POST here). */
export function unsubscribePostUrl(token: string): string {
  return `${env.siteUrl}/api/unsubscribe/${token}`;
}

/** Stop marketing email for this token. Returns false when the token is unknown. */
export async function unsubscribeEmail(token: string): Promise<boolean> {
  const rows = await db
    .update(subscribers)
    .set({ emailUnsubscribedAt: new Date() })
    .where(eq(subscribers.unsubscribeToken, token))
    .returning({ id: subscribers.id });
  return rows.length > 0;
}

export function emailActive(s: Pick<Subscriber, 'email' | 'emailOptIn' | 'emailUnsubscribedAt'>): boolean {
  return Boolean(s.email && s.emailOptIn && !s.emailUnsubscribedAt);
}
export function smsActive(s: Pick<Subscriber, 'phone' | 'smsOptIn' | 'smsStoppedAt'>): boolean {
  return Boolean(s.phone && s.smsOptIn && !s.smsStoppedAt);
}

type SignupResult = { emailNew: boolean; smsNew: boolean; token: string | null };

/**
 * Record an opt-in. Matches existing rows by email and by phone; re-opting in
 * clears a previous unsubscribe/STOP. Returns which channels are newly active
 * (so welcome messages go out once, not on every repeat signup).
 */
export async function recordSignup(input: { email: string | null; phone: string | null; source?: string }): Promise<SignupResult> {
  const { email, phone } = input;
  const consentText = [email ? EMAIL_CONSENT : null, phone ? SMS_CONSENT : null].filter(Boolean).join(' | ');
  const now = new Date();

  const byEmail = email ? (await db.select().from(subscribers).where(eq(subscribers.email, email)))[0] : undefined;
  const byPhone = phone ? (await db.select().from(subscribers).where(eq(subscribers.phone, phone)))[0] : undefined;

  const emailNew = Boolean(email) && !(byEmail && emailActive(byEmail));
  const smsNew = Boolean(phone) && !(byPhone && smsActive(byPhone));

  const emailPatch = email ? { emailOptIn: true, emailUnsubscribedAt: null } : {};
  const smsPatch = phone ? { smsOptIn: true, smsStoppedAt: null } : {};

  // Email and phone already belong to two different people/rows: update each.
  if (byEmail && byPhone && byEmail.id !== byPhone.id) {
    await db.update(subscribers).set({ ...emailPatch, consentText: EMAIL_CONSENT, consentAt: now }).where(eq(subscribers.id, byEmail.id));
    await db.update(subscribers).set({ ...smsPatch, consentText: SMS_CONSENT, consentAt: now }).where(eq(subscribers.id, byPhone.id));
    return { emailNew, smsNew, token: byEmail.unsubscribeToken };
  }

  const existing = byEmail ?? byPhone;
  if (existing) {
    await db
      .update(subscribers)
      .set({
        ...emailPatch,
        ...smsPatch,
        ...(email && !existing.email ? { email } : {}),
        ...(phone && !existing.phone ? { phone } : {}),
        consentText,
        consentAt: now,
      })
      .where(eq(subscribers.id, existing.id));
    return { emailNew, smsNew, token: existing.unsubscribeToken };
  }

  const token = newToken();
  await db.insert(subscribers).values({
    email,
    phone,
    emailOptIn: Boolean(email),
    smsOptIn: Boolean(phone),
    consentText,
    consentAt: now,
    source: input.source ?? 'website',
    unsubscribeToken: token,
  });
  return { emailNew, smsNew, token };
}
