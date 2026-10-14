import { dateTime } from '@/lib/format';
import { siteData } from '@/lib/site/api';
import { inputClass } from '@/components/dashboard/form';
import { ButtonLink, Empty, Panel, Pill } from '@/components/website/ui';
import { BroadcastComposer } from './BroadcastComposer';

export const dynamic = 'force-dynamic';

function Count({ label, value, hint }: { label: string; value: number; hint?: string }): React.JSX.Element {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--rule)] bg-bg-raised p-4">
      <div className="text-sm text-ink-2">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums text-ink">{value}</div>
      {hint ? <div className="mt-1 text-xs text-ink-3">{hint}</div> : null}
    </div>
  );
}

export default async function SubscribersPage({ searchParams }: PageProps<'/website/subscribers'>): Promise<React.JSX.Element> {
  const rawQ = (await searchParams).q;
  const q = (Array.isArray(rawQ) ? rawQ[0] : rawQ)?.trim().slice(0, 100) ?? '';
  const { counts, subscribers, broadcasts, specials } = await siteData('subscribers.list', q ? { query: q } : {});

  return (
    <div className="grid gap-6 [&>*]:min-w-0">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Count label="Email (active)" value={counts.emailActive} />
        <Count label="Text (active)" value={counts.smsActive} />
        <Count label="Unsubscribed" value={counts.unsubscribed} hint="off on every channel" />
        <Count label="All signups" value={counts.total} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Panel title="Send a broadcast" description="Goes only to people who opted in on that channel.">
          <BroadcastComposer specials={specials} />
        </Panel>

        <Panel title="Sent">
          {broadcasts.length === 0 ? (
            <Empty>No broadcasts yet.</Empty>
          ) : (
            <ul className="divide-y divide-[var(--rule)]">
              {broadcasts.map((b) => (
                <li key={b.id} className="py-2.5">
                  <p className="text-sm font-medium text-ink">{b.subject || b.body.slice(0, 60)}</p>
                  <p className="text-xs text-ink-3">
                    {b.sentAt ? dateTime(b.sentAt) : 'sending…'} · {b.sendEmail ? `${b.emailCount} emails` : 'no email'} ·{' '}
                    {b.sendSms ? `${b.smsCount} texts` : 'no texts'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="List"
        description="Contact details are partly hidden here; the CSV has everything, including the consent text each person agreed to."
        actions={<ButtonLink href="/website/subscribers/export">Download CSV</ButtonLink>}
      >
        <form role="search" className="mb-3 flex items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-ink-3">Search email or phone</span>
            <input name="q" type="search" defaultValue={q} maxLength={100} placeholder="e.g. gmail.com or 0142" className={inputClass} />
          </label>
          <button type="submit" className="rounded-[var(--radius)] border border-[var(--rule)] px-3 py-1.5 text-sm text-ink-2 hover:bg-bg-sunken">
            Search
          </button>
          {q ? (
            <a href="/website/subscribers" className="px-2 py-1.5 text-sm text-ink-3 hover:text-ink">
              Clear
            </a>
          ) : null}
        </form>
        {subscribers.length === 0 ? (
          <Empty>{q ? `Nobody matches “${q}”.` : 'No subscribers yet. The signup page is /specials on the website.'}</Empty>
        ) : (
          <ul className="divide-y divide-[var(--rule)]">
            {subscribers.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {[s.emailMasked, s.phoneMasked].filter(Boolean).join(' · ')}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {s.emailMasked ? <Pill tone={s.emailActive ? 'ok' : 'neutral'}>{s.emailActive ? 'Email' : 'Email off'}</Pill> : null}
                  {s.phoneMasked ? <Pill tone={s.smsActive ? 'ok' : 'neutral'}>{s.smsActive ? 'Text' : 'Text stopped'}</Pill> : null}
                </span>
                <span className="text-xs text-ink-3">
                  {s.source.replace(/_/g, ' ')} · {dateTime(s.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
