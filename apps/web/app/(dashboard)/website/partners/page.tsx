import Link from 'next/link';
import { money } from '@/lib/format';
import { siteData } from '@/lib/site/api';
import { NoticeBanner } from '@/components/dashboard/form';
import { ButtonLink, Empty, Panel, Pill } from '@/components/website/ui';

export const dynamic = 'force-dynamic';

const KIND = { bar: 'Bar', bartender: 'Bartender', other: 'Other' } as const;

export default async function WebsitePartnersPage({ searchParams }: PageProps<'/website/partners'>): Promise<React.JSX.Element> {
  const { deleted } = await searchParams;
  const { partners, totals } = await siteData('partners.list', {});

  return (
    <div className="grid min-w-0 gap-6">
      {deleted ? <NoticeBanner notice={{ tone: 'ok', text: 'Partner deleted.' }} /> : null}
      <Panel
        className="min-w-0"
        title="Partners"
        description="Each bar or bartender gets a link and a QR card. Orders placed within 24 hours of a scan are credited to them."
        actions={
          <ButtonLink href="/website/partners/new" primary>
            Add partner
          </ButtonLink>
        }
      >
        <dl className="grid grid-cols-3 gap-4 border-y border-[var(--rule)] py-3 text-sm">
          <div>
            <dt className="text-ink-3">Scans, 30 days</dt>
            <dd className="text-2xl font-semibold tabular-nums text-ink">{totals.visits30}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Orders credited</dt>
            <dd className="text-2xl font-semibold tabular-nums text-ink">{totals.orders}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Revenue credited</dt>
            <dd className="text-2xl font-semibold tabular-nums text-ink">{money(totals.revenueCents)}</dd>
          </div>
        </dl>

        {partners.length === 0 ? (
          <Empty>No partners yet.</Empty>
        ) : (
          <div className="relative -mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-3">
                  <th className="py-2 pr-3 font-normal">Partner</th>
                  <th className="py-2 pr-3 font-normal">Link</th>
                  <th className="py-2 pr-3 text-right font-normal">Scans 30d</th>
                  <th className="py-2 pr-3 text-right font-normal">Orders</th>
                  <th className="py-2 pr-3 text-right font-normal">Revenue</th>
                  <th className="py-2 font-normal">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--rule)]">
                    <td className="py-2.5 pr-3">
                      <Link href={`/website/partners/${p.id}`} className="font-medium text-ink hover:underline">
                        {p.name}
                      </Link>{' '}
                      <span className="text-ink-3">· {KIND[p.kind]}</span> {p.active ? null : <Pill>Inactive</Pill>}
                    </td>
                    <td className="py-2.5 pr-3">
                      <a href={p.referralUrl} target="_blank" rel="noreferrer" className="font-mono text-accent hover:underline">
                        /r/{p.code}
                      </a>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{p.stats.visits30}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{p.stats.orders}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{money(p.stats.revenueCents)}</td>
                    <td className="whitespace-nowrap py-2.5 text-right">
                      <Link href={`/website/partners/${p.id}`} className="rounded-[var(--radius)] px-2 py-1 text-ink-2 hover:bg-bg-sunken hover:text-ink">
                        Edit
                      </Link>
                      <Link href={`/website/partners/${p.id}/qr`} className="rounded-[var(--radius)] px-2 py-1 text-ink-2 hover:bg-bg-sunken hover:text-ink">
                        QR card
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
