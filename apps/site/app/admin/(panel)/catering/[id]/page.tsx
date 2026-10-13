import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { AdminPage, Card, Pill } from '@/components/admin/ui';
import { Button } from '@/components/ui/Button';
import { requireAdmin } from '@/lib/auth';
import { BUDGETS, DURATIONS, EVENT_TYPES, LEAD_STAGES, MENU_INTERESTS, SERVICE_STYLES, STAGE_LABEL, STAGE_TONE, labelFor } from '@/lib/catering';
import { db } from '@/lib/db/client';
import { cateringLeads } from '@/lib/db/schema';
import { dateTime, hhmm, prettyPhone, shortDate } from '@/lib/format';
import { updateLead } from '../actions';

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [lead] = await db.select().from(cateringLeads).where(eq(cateringLeads.id, id));
  if (!lead) notFound();

  const fields: Array<[string, React.ReactNode]> = [
    ['Event date', `${shortDate(`${lead.eventDate}T12:00:00`)} at ${hhmm(lead.startTime)}`],
    ['Duration', labelFor(DURATIONS, lead.durationHours)],
    ['Location', lead.location],
    ['Guests', lead.guestCount],
    ['Event type', labelFor(EVENT_TYPES, lead.eventType)],
    ['Service', labelFor(SERVICE_STYLES, lead.serviceStyle)],
    ['Menu interests', lead.menuInterests.map((m) => labelFor(MENU_INTERESTS, m)).join(', ') || '—'],
    ['Budget', labelFor(BUDGETS, lead.budgetRange)],
    ['Notes', lead.notes ?? '—'],
    ['Received', dateTime(lead.createdAt)],
  ];

  return (
    <AdminPage
      title={lead.name}
      actions={
        <Link href="/admin/catering" className="font-bold underline">
          ← All leads
        </Link>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={STAGE_TONE[lead.status]}>{STAGE_LABEL[lead.status]}</Pill>
        <a href={`tel:${lead.phone}`} className="inline-flex min-h-11 items-center rounded-sm border-2 border-outline bg-agave px-3 font-bold text-on-agave no-underline">
          Call {prettyPhone(lead.phone)}
        </a>
        <a href={`sms:${lead.phone}`} className="inline-flex min-h-11 items-center rounded-sm border-2 border-outline bg-surface px-3 font-bold no-underline">
          Text
        </a>
        <a
          href={`mailto:${lead.email}?subject=${encodeURIComponent('Your Barrio Burger Co. catering request')}`}
          className="inline-flex min-h-11 items-center rounded-sm border-2 border-outline bg-surface px-3 font-bold no-underline"
        >
          Email {lead.email}
        </a>
      </div>

      <Card title="Request">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
          {fields.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-sm font-bold text-ink-muted">{k}</dt>
              <dd className="whitespace-pre-wrap">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Pipeline">
        <form action={updateLead} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={lead.id} />
          <fieldset>
            <legend className="mb-2 text-sm font-bold">Stage</legend>
            <div className="flex flex-wrap gap-2">
              {LEAD_STAGES.map((s) => (
                <label
                  key={s}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border-2 border-outline bg-surface-2 px-3 font-bold has-[:checked]:bg-marigold has-[:checked]:text-on-marigold"
                >
                  <input type="radio" name="status" value={s} defaultChecked={lead.status === s} className="h-4 w-4" />
                  {STAGE_LABEL[s]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">Notes (only you see these)</span>
            <textarea
              name="adminNotes"
              rows={4}
              defaultValue={lead.adminNotes ?? ''}
              className="rounded-sm border-2 border-outline bg-paper p-3 text-paper-ink"
            />
          </label>
          <Button type="submit" className="self-start">
            Save
          </Button>
        </form>
      </Card>
    </AdminPage>
  );
}
