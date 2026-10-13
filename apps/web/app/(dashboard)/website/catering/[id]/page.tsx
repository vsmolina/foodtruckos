import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dateTime } from '@/lib/format';
import { siteApi } from '@/lib/site/api';
import { SiteUnavailableError } from '@/lib/site/api';
import { Panel, Pill } from '@/components/website/ui';
import { LeadForm } from '../LeadForm';
import { eventDay, hhmm, prettyPhone, STAGE_LABEL, STAGE_TONE } from '../shared';

export const dynamic = 'force-dynamic';

const contactClass =
  'inline-flex min-h-10 items-center rounded-[var(--radius)] border border-[var(--rule)] px-3 text-sm font-medium text-ink-2 hover:bg-bg-sunken hover:text-ink';

export default async function LeadPage({ params }: PageProps<'/website/catering/[id]'>): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const result = await siteApi('catering.get', { id });
  if (!result.ok) {
    if (/doesn’t exist/.test(result.error)) notFound();
    throw new SiteUnavailableError(result.error);
  }
  const lead = result.data;

  const fields: Array<[string, React.ReactNode]> = [
    ['Event', `${eventDay(lead.eventDate)} at ${hhmm(lead.startTime)} · ${lead.durationLabel}`],
    ['Location', lead.location],
    ['Guests', lead.guestCount],
    ['Event type', lead.eventTypeLabel],
    ['Service', lead.serviceStyleLabel],
    ['Menu interests', lead.menuInterestLabels.join(', ') || '—'],
    ['Budget', lead.budgetLabel ?? '—'],
    ['Their notes', lead.notes ?? '—'],
    ['Received', dateTime(lead.createdAt)],
  ];

  return (
    <div className="grid gap-6 [&>*]:min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/website/catering" className="text-sm text-ink-2 hover:text-ink hover:underline">
          ← All leads
        </Link>
        <h2 className="font-display text-2xl text-ink">{lead.name}</h2>
        <Pill tone={STAGE_TONE[lead.status]}>{STAGE_LABEL[lead.status]}</Pill>
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={`tel:${lead.phone}`} className={contactClass}>
          Call {prettyPhone(lead.phone)}
        </a>
        <a href={`sms:${lead.phone}`} className={contactClass}>
          Text
        </a>
        <a href={`mailto:${lead.email}?subject=${encodeURIComponent('Your Barrio Burger Co. catering request')}`} className={`${contactClass} max-w-full truncate`}>
          Email {lead.email}
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr] [&>*]:min-w-0">
        <Panel title="Request">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[9rem_1fr]">
            {fields.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-xs uppercase tracking-wide text-ink-3 sm:pt-0.5">{k}</dt>
                <dd className="whitespace-pre-wrap break-words text-sm text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Pipeline" description={`Updated ${dateTime(lead.updatedAt)}`}>
          <LeadForm id={lead.id} status={lead.status} adminNotes={lead.adminNotes} />
        </Panel>
      </div>
    </div>
  );
}
