import Link from 'next/link';
import { count, desc, eq } from 'drizzle-orm';
import { AdminPage, Empty, Pill, Row } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth';
import { EVENT_TYPES, LEAD_STAGES, STAGE_LABEL, STAGE_TONE, labelFor, type LeadStage } from '@/lib/catering';
import { cx } from '@/lib/cx';
import { db } from '@/lib/db/client';
import { cateringLeads } from '@/lib/db/schema';
import { hhmm, shortDate } from '@/lib/format';

export default async function CateringAdmin({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  await requireAdmin();
  const { stage: raw } = await searchParams;
  const stage = (LEAD_STAGES as readonly string[]).includes(raw ?? '') ? (raw as LeadStage) : null;

  const [counts, leads] = await Promise.all([
    db.select({ status: cateringLeads.status, n: count() }).from(cateringLeads).groupBy(cateringLeads.status),
    db
      .select()
      .from(cateringLeads)
      .where(stage ? eq(cateringLeads.status, stage) : undefined)
      .orderBy(desc(cateringLeads.createdAt))
      .limit(200),
  ]);
  const n = (s: LeadStage) => counts.find((c) => c.status === s)?.n ?? 0;

  return (
    <AdminPage title="Catering">
      <nav aria-label="Pipeline stages" className="-mx-4 overflow-x-auto px-4">
        <ol className="flex gap-2">
          <li>
            <StageLink href="/admin/catering" active={!stage} label="All" n={counts.reduce((a, c) => a + c.n, 0)} />
          </li>
          {LEAD_STAGES.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              {i > 0 && s !== 'declined' ? <span aria-hidden className="text-ink-muted">→</span> : null}
              <StageLink href={`/admin/catering?stage=${s}`} active={stage === s} label={STAGE_LABEL[s]} n={n(s)} />
            </li>
          ))}
        </ol>
      </nav>

      {leads.length === 0 ? (
        <Empty>{stage ? `No ${STAGE_LABEL[stage].toLowerCase()} leads.` : 'No catering requests yet.'}</Empty>
      ) : (
        <ul className="rounded-md border-2 border-outline bg-surface px-4">
          {leads.map((l) => (
            <Row key={l.id}>
              <div className="min-w-0 flex-1">
                <Link href={`/admin/catering/${l.id}`} className="font-bold underline decoration-2 underline-offset-2">
                  {l.name}
                </Link>
                <p className="text-sm text-ink-muted">
                  {labelFor(EVENT_TYPES, l.eventType)} · {l.guestCount} guests · {shortDate(`${l.eventDate}T12:00:00`)} {hhmm(l.startTime)}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Pill tone={STAGE_TONE[l.status]}>{STAGE_LABEL[l.status]}</Pill>
                <span className="text-ink-muted">received {shortDate(l.createdAt)}</span>
              </div>
            </Row>
          ))}
        </ul>
      )}
    </AdminPage>
  );
}

function StageLink({ href, active, label, n }: { href: string; active: boolean; label: string; n: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-sm border-2 border-outline px-3 text-sm font-bold no-underline',
        active ? 'bg-marigold text-on-marigold' : 'bg-surface text-ink',
      )}
    >
      {label}
      <span className="tabular-nums opacity-80">{n}</span>
    </Link>
  );
}
