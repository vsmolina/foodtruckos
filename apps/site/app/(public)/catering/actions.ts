'use server';

import { db } from '@/lib/db/client';
import { cateringLeads } from '@/lib/db/schema';
import { BUDGETS, DURATIONS, EVENT_TYPES, MENU_INTERESTS, SERVICE_STYLES, cateringSchema, labelFor } from '@/lib/catering';
import { env } from '@/lib/env';
import { hhmm, prettyPhone } from '@/lib/format';
import { ownerContacts, sendEmail } from '@/lib/messaging/email';
import { sendSms } from '@/lib/messaging/sms';
import { isBot, rateLimit } from '@/lib/rate-limit';

export type CateringState =
  | { status: 'idle' }
  | { status: 'error'; attempt: number; message?: string; fieldErrors: Record<string, string>; values: Record<string, string | string[]> }
  | { status: 'success'; name: string; email: string };

function formValues(form: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of ['name', 'phone', 'email', 'eventDate', 'startTime', 'durationHours', 'location', 'guestCount', 'eventType', 'serviceStyle', 'budgetRange', 'notes']) {
    out[key] = String(form.get(key) ?? '');
  }
  out.menuInterests = form.getAll('menuInterests').map(String);
  return out;
}

/** Bumped on each failed try so the form remounts with the entered values. */
function attempt(prev: CateringState): number {
  return prev.status === 'error' ? prev.attempt + 1 : 1;
}

export async function submitCatering(_prev: CateringState, form: FormData): Promise<CateringState> {
  const values = formValues(form);
  // Bots get a fake success so they don't learn to avoid the trap.
  if (isBot(form)) return { status: 'success', name: String(values.name), email: String(values.email) };

  const parsed = cateringSchema.safeParse({
    ...values,
    budgetRange: values.budgetRange || undefined,
    notes: values.notes || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      fieldErrors[key] ??= issue.message;
    }
    return { status: 'error', attempt: attempt(_prev), message: 'A few things need fixing — see the highlighted fields.', fieldErrors, values };
  }

  if (!(await rateLimit('catering', 5, 60 * 60))) {
    return { status: 'error', attempt: attempt(_prev), message: 'Too many requests from this connection. Try again in an hour, or call us.', fieldErrors: {}, values };
  }

  const d = parsed.data;
  const [lead] = await db
    .insert(cateringLeads)
    .values({
      name: d.name,
      phone: d.phone,
      email: d.email,
      eventDate: d.eventDate,
      startTime: d.startTime,
      durationHours: d.durationHours,
      location: d.location,
      guestCount: d.guestCount,
      eventType: d.eventType,
      serviceStyle: d.serviceStyle,
      menuInterests: d.menuInterests,
      budgetRange: d.budgetRange ?? null,
      notes: d.notes ?? null,
    })
    .returning({ id: cateringLeads.id });

  const summary = [
    `Name: ${d.name}`,
    `Phone: ${prettyPhone(d.phone)}`,
    `Email: ${d.email}`,
    `Date: ${d.eventDate} at ${hhmm(d.startTime)} (${labelFor(DURATIONS, d.durationHours)})`,
    `Where: ${d.location}`,
    `Guests: ${d.guestCount}`,
    `Type: ${labelFor(EVENT_TYPES, d.eventType)} · ${labelFor(SERVICE_STYLES, d.serviceStyle)}`,
    `Menu: ${d.menuInterests.map((m) => labelFor(MENU_INTERESTS, m)).join(', ') || '—'}`,
    `Budget: ${labelFor(BUDGETS, d.budgetRange)}`,
    `Notes: ${d.notes ?? '—'}`,
  ].join('\n');

  const owner = ownerContacts();
  if (!owner.email && !owner.phone) console.warn('[catering] OWNER_EMAIL / OWNER_PHONE not set — no owner alert sent for lead', lead!.id);
  const adminUrl = `${env.siteUrl}/admin/catering/${lead!.id}`;
  await Promise.all([
    owner.email
      ? sendEmail({ to: owner.email, subject: `New catering request: ${d.name}, ${d.eventDate}`, text: `${summary}\n\nOpen: ${adminUrl}`, replyTo: d.email })
      : Promise.resolve(true),
    owner.phone
      ? sendSms(owner.phone, `Barrio catering lead: ${d.name}, ${d.guestCount} guests, ${d.eventDate}. ${adminUrl}`)
      : Promise.resolve(true),
    sendEmail({
      to: d.email,
      subject: 'We got your catering request — Barrio Burger Co.',
      text: `Hi ${d.name},\n\n¡Gracias! We got your request and will reach out within 2 business days to talk details and send a quote. Nothing is booked until we confirm with you.\n\nWhat you sent us:\n${summary}\n\nQuestions? Just reply to this email.\n\n— Barrio Burger Co.`,
      ...(owner.email ? { replyTo: owner.email } : {}),
    }),
  ]);

  return { status: 'success', name: d.name, email: d.email };
}
