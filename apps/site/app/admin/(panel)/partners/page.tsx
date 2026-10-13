import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { AdminPage, Empty, Pill, Row } from '@/components/admin/ui';
import { LinkButton } from '@/components/ui/Button';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { partners } from '@/lib/db/schema';
import { money } from '@/lib/format';
import { referralUrl } from '@/lib/partners/qr';
import { partnerStats } from '@/lib/partners/stats';

export const dynamic = 'force-dynamic';

export default async function AdminPartnersPage() {
  await requireAdmin();
  const rows = await db.select().from(partners).orderBy(asc(partners.sortOrder), asc(partners.name));
  const stats = await partnerStats(rows.map((r) => r.id));
  const total = [...stats.values()].reduce((a, s) => ({ v: a.v + s.visits30, o: a.o + s.orders, c: a.c + s.revenueCents }), { v: 0, o: 0, c: 0 });

  return (
    <AdminPage title="Partners" actions={<LinkButton href="/admin/partners/new" size="sm">Add partner</LinkButton>}>
      <p className="text-sm text-ink-muted">
        Each partner gets a link and QR code. Scans are counted for 30 days; orders placed within 24 hours of a scan are credited to that partner.
        Totals: {total.v} scans (30 days) · {total.o} orders · {money(total.c)}.
      </p>
      {rows.length === 0 ? (
        <Empty>No partners yet.</Empty>
      ) : (
        <ul className="rounded-md border-2 border-outline bg-surface px-4">
          {rows.map((p) => {
            const s = stats.get(p.id)!;
            return (
              <Row key={p.id}>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {p.name} <span className="font-normal text-ink-muted">· {p.kind}</span> {p.active ? null : <Pill tone="grey">Inactive</Pill>}
                  </p>
                  <a href={referralUrl(p.code)} className="break-all font-mono text-sm underline" target="_blank" rel="noopener">
                    /r/{p.code}
                  </a>
                </div>
                <dl className="grid grid-cols-3 gap-3 text-sm sm:w-72">
                  <div>
                    <dt className="text-ink-muted">Scans 30d</dt>
                    <dd className="font-bold tabular-nums">{s.visits30}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Orders</dt>
                    <dd className="font-bold tabular-nums">{s.orders}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Revenue</dt>
                    <dd className="font-bold tabular-nums">{money(s.revenueCents)}</dd>
                  </div>
                </dl>
                <div className="flex gap-1">
                  <Link href={`/admin/partners/${p.id}`} className="inline-flex min-h-11 items-center px-2 font-bold underline">
                    Edit
                  </Link>
                  <Link href={`/admin/partners/${p.id}/qr`} className="inline-flex min-h-11 items-center px-2 font-bold underline">
                    QR card
                  </Link>
                </div>
              </Row>
            );
          })}
        </ul>
      )}
    </AdminPage>
  );
}
