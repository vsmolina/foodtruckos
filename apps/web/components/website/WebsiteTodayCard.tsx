import Link from 'next/link';
import type { TruckStatus } from '@barrio/site-contract';
import { money } from '@/lib/format';
import { siteApi, siteConfigured } from '@/lib/site/api';
import { setStatus } from '@/app/(dashboard)/website/status/actions';
import { ActionForm } from './ActionForm';
import { Pill } from './ui';

// The customer website at a glance on Today: status (with a quick switch),
// online ordering, and what's waiting. Never throws — if the website can't be
// reached, it shows one quiet line and the rest of Today renders as normal.

const STATUS: Record<TruckStatus, { label: string; tone: 'ok' | 'warn' | 'danger' }> = {
  open: { label: 'Open now', tone: 'ok' },
  back_soon: { label: 'Back soon', tone: 'warn' },
  closed: { label: 'Closed', tone: 'danger' },
};
const ORDER: TruckStatus[] = ['open', 'back_soon', 'closed'];

function Quiet({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="mt-6 flex flex-wrap items-baseline gap-x-2 rounded-[var(--radius-lg)] border border-[var(--rule)] bg-bg-raised px-5 py-3 text-sm text-ink-3">
      <span className="font-medium text-ink-2">Website</span>
      {children}
    </p>
  );
}

function Count({ href, label, value, hint }: { href: string; label: string; value: string | number; hint?: string }): React.JSX.Element {
  return (
    <Link href={href} className="block rounded-[var(--radius)] border border-[var(--rule)] px-3 py-2 hover:bg-bg-sunken">
      <span className="block text-xs text-ink-3">{label}</span>
      <span className="block text-xl font-semibold tabular-nums text-ink">{value}</span>
      {hint ? <span className="block text-xs text-ink-3">{hint}</span> : null}
    </Link>
  );
}

export async function WebsiteTodayCard(): Promise<React.JSX.Element> {
  if (!siteConfigured()) {
    return (
      <Quiet>
        not connected —{' '}
        <Link href="/website" className="text-accent hover:underline">
          set it up
        </Link>
      </Quiet>
    );
  }
  const result = await siteApi('insights.today', {});
  if (!result.ok) return <Quiet>couldn’t be reached just now. {result.error}</Quiet>;
  const t = result.data;
  const s = STATUS[t.status];
  const ordering =
    t.status !== 'open' ? 'Online ordering off' : t.orderingPaused ? 'Online orders paused' : 'Taking online orders';
  const note = t.status === 'open' ? (t.orderingPaused ? t.pausedMessage : null) : t.statusMessage;

  return (
    <section aria-labelledby="website-today" className="mt-6 rounded-[var(--radius-lg)] border border-[var(--rule)] bg-bg-raised p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 id="website-today" className="font-display text-xl text-ink">
            Website
          </h2>
          <Pill tone={s.tone}>{s.label}</Pill>
          <Pill tone={t.status === 'open' && !t.orderingPaused ? 'ok' : t.orderingPaused ? 'warn' : 'neutral'}>{ordering}</Pill>
        </div>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Change website status">
          {ORDER.filter((v) => v !== t.status).map((v) => (
            <ActionForm key={v} action={setStatus.bind(null, v)}>
              <button
                type="submit"
                className="whitespace-nowrap rounded-[var(--radius)] border border-[var(--rule)] px-2.5 py-1 text-sm text-ink-2 hover:bg-bg-sunken hover:text-ink"
              >
                Set {STATUS[v].label.toLowerCase()}
              </button>
            </ActionForm>
          ))}
          <Link href="/website/status" className="px-2 text-sm font-medium text-accent hover:underline">
            Status →
          </Link>
        </div>
      </div>
      {note ? <p className="mt-1 text-sm text-ink-3">{note}</p> : null}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Count href="/website/insights" label="Web orders tonight" value={t.ordersTonight} hint={money(t.revenueTonightCents)} />
        <Count href="/website/catering?stage=new" label="New catering leads" value={t.newLeads} hint={`${t.openLeads} open in total`} />
        <Count
          href="/website/gallery"
          label="Photos to review"
          value={t.photosPending}
          {...(t.takedownsOpen ? { hint: `${t.takedownsOpen} takedown request${t.takedownsOpen === 1 ? '' : 's'}!` } : {})}
        />
        <Count href="/website/merch" label="Merch to ship" value={t.merchToShip} />
      </div>
    </section>
  );
}
