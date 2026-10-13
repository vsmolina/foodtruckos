import Link from 'next/link';
import { dateTime } from '@/lib/format';
import { siteData } from '@/lib/site/api';
import { Empty, Panel, Pill } from '@/components/website/ui';
import { eventDay, hhmm, isStage, STAGE_LABEL, STAGE_TONE, STAGES } from './shared';

export const dynamic = 'force-dynamic';

export default async function CateringPage({ searchParams }: PageProps<'/website/catering'>): Promise<React.JSX.Element> {
  const raw = (await searchParams).stage;
  const stage = isStage(raw) ? raw : null;
  const { counts, total, leads } = await siteData('catering.list', { stage });

  return (
    <div className="grid gap-6 [&>*]:min-w-0">
      <nav aria-label="Pipeline stages" className="-mx-1 overflow-x-auto px-1">
        <ol className="flex min-w-max items-center gap-2">
          <li>
            <StageLink href="/website/catering" active={!stage} label="All" n={total} />
          </li>
          {STAGES.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              {i > 0 && s !== 'declined' ? <span aria-hidden className="text-ink-3">→</span> : null}
              {s === 'declined' ? <span aria-hidden className="text-ink-3">·</span> : null}
              <StageLink href={`/website/catering?stage=${s}`} active={stage === s} label={STAGE_LABEL[s]} n={counts[s]} />
            </li>
          ))}
        </ol>
      </nav>

      <Panel title={stage ? `${STAGE_LABEL[stage]} leads` : 'All leads'} description="Requests from the website’s catering form, newest first.">
        {leads.length === 0 ? (
          <Empty>{stage ? `No ${STAGE_LABEL[stage].toLowerCase()} leads.` : 'No catering requests yet.'}</Empty>
        ) : (
          <ul className="divide-y divide-[var(--rule)]">
            {leads.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/website/catering/${l.id}`} className="font-medium text-ink hover:text-accent hover:underline">
                    {l.name}
                  </Link>
                  <p className="text-sm text-ink-3">
                    {l.eventTypeLabel} · {l.guestCount} guests · {eventDay(l.eventDate)}, {hhmm(l.startTime)}
                  </p>
                </div>
                <Pill tone={STAGE_TONE[l.status]}>{STAGE_LABEL[l.status]}</Pill>
                <span className="text-xs text-ink-3">received {dateTime(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function StageLink({ href, active, label, n }: { href: string; active: boolean; label: string; n: number }): React.JSX.Element {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-[var(--radius)] border px-3 text-sm ${
        active ? 'border-[var(--accent)] bg-bg-raised font-medium text-ink' : 'border-[var(--rule)] text-ink-2 hover:bg-bg-sunken'
      }`}
    >
      {label}
      <span className="tabular-nums text-ink-3">{n}</span>
    </Link>
  );
}
