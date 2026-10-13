import { z } from 'zod';
import { toE164 } from '@/lib/format';

// Catering request options and validation, shared by the public form and admin.

export const DURATIONS = [
  { value: '1-2', label: '1–2 hours' },
  { value: '2-3', label: '2–3 hours' },
  { value: '3-4', label: '3–4 hours' },
  { value: '4+', label: '4+ hours' },
] as const;

export const EVENT_TYPES = [
  { value: 'private_party', label: 'Private party' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'bar_event', label: 'Bar event' },
  { value: 'other', label: 'Other' },
] as const;

export const SERVICE_STYLES = [
  { value: 'truck', label: 'Truck on site' },
  { value: 'drop_off', label: 'Drop-off' },
] as const;

export const MENU_INTERESTS = [
  { value: 'burgers', label: 'Burgers' },
  { value: 'dogs', label: 'Bacon-wrapped dogs' },
  { value: 'sides', label: 'Sides' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'everything', label: 'A bit of everything' },
] as const;

export const BUDGETS = [
  { value: 'under_500', label: 'Under $500' },
  { value: '500_1000', label: '$500–$1,000' },
  { value: '1000_2500', label: '$1,000–$2,500' },
  { value: '2500_plus', label: '$2,500+' },
  { value: 'not_sure', label: 'Not sure yet' },
] as const;

export const LEAD_STAGES = ['new', 'contacted', 'quoted', 'booked', 'declined'] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export const STAGE_LABEL: Record<LeadStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  quoted: 'Quoted',
  booked: 'Booked',
  declined: 'Declined',
};

export const STAGE_TONE: Record<LeadStage, 'amber' | 'blue' | 'pink' | 'green' | 'grey'> = {
  new: 'amber',
  contacted: 'blue',
  quoted: 'pink',
  booked: 'green',
  declined: 'grey',
};

export function labelFor(list: ReadonlyArray<{ value: string; label: string }>, value: string | null | undefined): string {
  return list.find((o) => o.value === value)?.label ?? value ?? '—';
}

const values = <T extends ReadonlyArray<{ value: string }>>(list: T) =>
  list.map((o) => o.value) as unknown as [T[number]['value'], ...Array<T[number]['value']>];

/** Today's date (YYYY-MM-DD) in the truck's timezone. */
export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(now);
}

export const cateringSchema = z.object({
  name: z.string().trim().min(2, 'Tell us your name.').max(100),
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const e164 = toE164(v);
      if (!e164) {
        ctx.addIssue({ code: 'custom', message: 'Enter a 10-digit US phone number.' });
        return z.NEVER;
      }
      return e164;
    }),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(200),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick the event date.')
    .refine((d) => d >= todayISO(), 'The event date can’t be in the past.'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Pick a start time.'),
  durationHours: z.enum(values(DURATIONS), { message: 'Pick how long the event runs.' }),
  location: z.string().trim().min(4, 'Where is the event? An address or venue works.').max(300),
  guestCount: z.coerce
    .number({ message: 'Enter a guest count.' })
    .int('Use a whole number.')
    .min(10, 'We cater events of 10 guests or more.')
    .max(2000, 'For more than 2,000 guests, call us.'),
  eventType: z.enum(values(EVENT_TYPES), { message: 'Pick an event type.' }),
  serviceStyle: z.enum(values(SERVICE_STYLES), { message: 'Truck on site or drop-off?' }),
  menuInterests: z.array(z.enum(values(MENU_INTERESTS))).max(5).default([]),
  budgetRange: z.enum(values(BUDGETS)).optional(),
  notes: z.string().trim().max(2000, 'Keep notes under 2,000 characters.').optional(),
});

export type CateringInput = z.infer<typeof cateringSchema>;
