import Link from 'next/link';
import type { SpecialDto } from '@barrio/site-contract';
import { NoticeBanner } from '@/components/dashboard/form';
import { siteAsset, siteData } from '@/lib/site/api';
import { ButtonLink, Empty, Panel, Pill } from '@/components/website/ui';
import { ActiveToggle } from './SpecialForm';
import { StateLine } from './StateLine';

export const dynamic = 'force-dynamic';

const GROUPS: Array<{ title: string; description: string; states: SpecialDto['state'][] }> = [
  { title: 'Live now', description: 'Showing on Home and the Specials page.', states: ['live'] },
  { title: 'Scheduled', description: 'Turn on by themselves at their start time.', states: ['scheduled'] },
  { title: 'Off & ended', description: 'Not on the website.', states: ['off', 'ended'] },
];

function SpecialRow({ s }: { s: SpecialDto }): React.JSX.Element {
  const photo = siteAsset(s.photoUrl);
  return (
    <li className="flex flex-col gap-3 border-t border-[var(--rule)] py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote website image, small thumb
          <img src={photo} alt="" className="size-12 shrink-0 rounded-[var(--radius)] border border-[var(--rule)] object-cover" />
        ) : null}
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Link href={`/website/specials/${s.id}`} className="font-medium text-ink hover:text-accent hover:underline">
              {s.title}
            </Link>
            {s.kicker ? <Pill tone="accent">{s.kicker}</Pill> : null}
            {s.priceLabel ? <span className="font-mono text-sm tabular-nums text-ink-2">{s.priceLabel}</span> : null}
          </div>
          <div className="mt-1">
            <StateLine special={s} />
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ActiveToggle id={s.id} active={s.active} />
        <ButtonLink href={`/website/specials/${s.id}`}>Edit</ButtonLink>
      </div>
    </li>
  );
}

export default async function WebsiteSpecialsPage({ searchParams }: PageProps<'/website/specials'>): Promise<React.JSX.Element> {
  const [{ specials }, sp] = await Promise.all([siteData('specials.list', {}), searchParams]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-2">
          Specials show on the website’s Home and Specials pages while they’re live. To text or email one to subscribers, use the
          Subscribers tab.
        </p>
        <ButtonLink href="/website/specials/new" primary>
          New special
        </ButtonLink>
      </div>
      <NoticeBanner notice={sp.deleted ? { tone: 'ok', text: 'Special deleted.' } : null} />

      {specials.length === 0 ? (
        <Panel>
          <Empty>No specials yet.</Empty>
        </Panel>
      ) : (
        GROUPS.map((g) => {
          const rows = specials.filter((s) => g.states.includes(s.state));
          if (rows.length === 0) return null;
          return (
            <Panel key={g.title} title={g.title} description={g.description}>
              <ul>
                {rows.map((s) => (
                  <SpecialRow key={s.id} s={s} />
                ))}
              </ul>
            </Panel>
          );
        })
      )}
    </div>
  );
}
