import 'server-only';
import { revalidatePath } from 'next/cache';
import { asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { BroadcastDto, BroadcastPreview, SubscriberDto } from '@barrio/site-contract';
import { audience, renderBroadcast, sendBroadcast as send, type BroadcastInput } from '@/lib/broadcast';
import { db } from '@/lib/db/client';
import { broadcasts, specials, subscribers } from '@/lib/db/schema';
import { prettyPhone } from '@/lib/format';
import { emailActive, smsActive } from '@/lib/subscribers';
import { fail, ok, type Result } from './result';

// Subscriber list, CSV export and broadcasts. No auth here: callers (admin
// server actions, admin API) check it first. Sending always goes through
// lib/broadcast.ts, which only reaches opted-in, not-unsubscribed people.

type Row = typeof subscribers.$inferSelect;

export function maskEmail(email: string): string {
  const [u = '', d = ''] = email.split('@');
  return `${u.slice(0, 2)}•••@${d}`;
}
export function maskPhone(phone: string): string {
  return prettyPhone(phone).replace(/\d{3}-(\d{4})$/, '•••-$1').replace(/^\(\d{3}\)/, '(•••)');
}

function toDto(s: Row): SubscriberDto {
  return {
    id: s.id,
    emailMasked: s.email ? maskEmail(s.email) : null,
    phoneMasked: s.phone ? maskPhone(s.phone) : null,
    emailActive: emailActive(s),
    smsActive: smsActive(s),
    emailOff: Boolean(s.email) && !emailActive(s),
    smsOff: Boolean(s.phone) && !smsActive(s),
    source: s.source,
    createdAt: s.createdAt.toISOString(),
  };
}

function broadcastDto(b: typeof broadcasts.$inferSelect): BroadcastDto {
  return {
    id: b.id,
    subject: b.subject,
    body: b.body,
    sendEmail: b.sendEmail,
    sendSms: b.sendSms,
    emailCount: b.emailCount,
    smsCount: b.smsCount,
    sentAt: b.sentAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
  };
}

const ListSchema = z.object({ query: z.string().trim().max(100).optional() });

function matches(s: Row, query: string): boolean {
  const q = query.toLowerCase();
  const digits = q.replace(/\D/g, '');
  if (s.email?.toLowerCase().includes(q)) return true;
  return digits.length >= 3 && Boolean(s.phone?.replace(/\D/g, '').includes(digits));
}

export async function listSubscribers(input: unknown) {
  const parsed = ListSchema.safeParse(input ?? {});
  if (!parsed.success) return fail('Search is too long.');
  const [all, sent, specialRows] = await Promise.all([
    db.select().from(subscribers).orderBy(desc(subscribers.createdAt)),
    db.select().from(broadcasts).orderBy(desc(broadcasts.createdAt)).limit(10),
    db.select({ id: specials.id, title: specials.title }).from(specials).where(eq(specials.active, true)).orderBy(desc(specials.createdAt)),
  ]);
  const query = parsed.data.query ?? '';
  const shown = (query ? all.filter((s) => matches(s, query)) : all).slice(0, 500);
  return ok({
    counts: {
      emailActive: all.filter(emailActive).length,
      smsActive: all.filter(smsActive).length,
      total: all.length,
      unsubscribed: all.filter((s) => !emailActive(s) && !smsActive(s)).length,
    },
    subscribers: shown.map(toDto),
    broadcasts: sent.map(broadcastDto),
    specials: specialRows,
  });
}

function cell(v: unknown): string {
  const s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
  // Quote, escape quotes, and neutralise spreadsheet formulas.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function subscribersCsv(): Promise<{ filename: string; csv: string }> {
  const rows = await db.select().from(subscribers).orderBy(asc(subscribers.createdAt));
  const header = ['email', 'phone', 'email_active', 'sms_active', 'consent_text', 'consent_at', 'source', 'email_unsubscribed_at', 'sms_stopped_at', 'created_at'];
  const lines = rows.map((r) =>
    [r.email, r.phone, emailActive(r), smsActive(r), r.consentText, r.consentAt, r.source, r.emailUnsubscribedAt, r.smsStoppedAt, r.createdAt].map(cell).join(','),
  );
  return {
    filename: `barrio-subscribers-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: [header.join(','), ...lines].join('\n'),
  };
}

export const BroadcastSchema = z
  .object({
    subject: z.string().trim().max(150),
    body: z.string().trim().min(5, 'Write the message.').max(600, 'Keep it under 600 characters.'),
    sendEmail: z.boolean(),
    sendSms: z.boolean(),
    specialId: z.union([z.uuid(), z.literal(''), z.null()]),
  })
  .refine((v) => v.sendEmail || v.sendSms, { message: 'Pick email, text, or both.', path: ['sendEmail'] })
  .refine((v) => !v.sendEmail || v.subject.length >= 3, { message: 'Emails need a subject.', path: ['subject'] });

function parseBroadcast(input: unknown): { ok: true; data: BroadcastInput } | { ok: false; error: string; fieldErrors: Record<string, string> } {
  const parsed = BroadcastSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? '')] ??= i.message;
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.', fieldErrors };
  }
  return { ok: true, data: { ...parsed.data, specialId: parsed.data.specialId || null } };
}

// GSM 03.38 basic set + extension table (extension chars cost two septets).
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXT = '^{}\\[~]|€\f';

/** Billed segments for one SMS: GSM-7 160/153 per part, otherwise UCS-2 70/67. */
export function smsSegments(text: string): number {
  let septets = 0;
  let gsm = true;
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) septets += 1;
    else if (GSM_EXT.includes(ch)) septets += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (gsm) return septets <= 160 ? 1 : Math.ceil(septets / 153);
  // UCS-2 counts UTF-16 code units.
  const units = text.length;
  return units <= 70 ? 1 : Math.ceil(units / 67);
}

export async function previewBroadcast(input: unknown): Promise<Result<BroadcastPreview>> {
  const parsed = parseBroadcast(input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const [rendered, to] = await Promise.all([renderBroadcast(parsed.data), audience()]);
  return ok({
    sms: rendered.sms,
    smsChars: rendered.sms.length,
    smsSegments: smsSegments(rendered.sms),
    emailSubject: rendered.emailSubject,
    emailText: rendered.emailText('https://…/unsubscribe/(their link)'),
    emailRecipients: parsed.data.sendEmail ? to.email.length : 0,
    smsRecipients: parsed.data.sendSms ? to.sms.length : 0,
  });
}

export async function sendBroadcast(input: unknown): Promise<Result<{ id: string; emailCount: number; smsCount: number }>> {
  const parsed = parseBroadcast(input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const to = await audience();
  if ((parsed.data.sendEmail ? to.email.length : 0) + (parsed.data.sendSms ? to.sms.length : 0) === 0) {
    return fail('Nobody has opted in on that channel yet.');
  }
  const res = await send(parsed.data);
  revalidatePath('/', 'layout');
  return ok(res);
}
