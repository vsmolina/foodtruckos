import Link from 'next/link';
import { asc, desc } from 'drizzle-orm';
import { AdminPage, Card, Empty, Pill } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { specials } from '@/lib/db/schema';
import { dateTime } from '@/lib/format';
import { toggleSpecial } from './actions';

export default async function SpecialsAdmin() {
  await requireAdmin();
  const rows = await db.select().from(specials).orderBy(desc(specials.active), asc(specials.sortOrder), desc(specials.createdAt));
  const now = new Date();
  return (
    <AdminPage
      title="Specials"
      actions={
        <Link href="/admin/specials/new" className="inline-flex min-h-11 items-center rounded-md border-2 border-outline bg-marigold px-4 font-bold text-on-marigold no-underline">
          + New special
        </Link>
      }
    >
      <p className="text-sm text-ink-muted">Active specials show on Home and the Specials page. To text or email one to subscribers, use Subscribers → Broadcast.</p>
      {rows.length === 0 ? <Empty>No specials yet.</Empty> : null}
      <Card>
        <ul>
          {rows.map((s) => {
            const live = s.active && (!s.startsAt || s.startsAt <= now) && (!s.endsAt || s.endsAt > now);
            return (
              <li key={s.id} className="flex flex-col gap-2 border-b-2 border-surface-2 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/admin/specials/${s.id}`} className="font-bold underline">
                    {s.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
                    {live ? <Pill tone="green">Live</Pill> : s.active ? <Pill tone="amber">Scheduled / ended</Pill> : <Pill tone="grey">Off</Pill>}
                    {s.kicker ? <Pill tone="pink">{s.kicker}</Pill> : null}
                    {s.priceLabel ? <span>{s.priceLabel}</span> : null}
                    {s.startsAt ? <span>from {dateTime(s.startsAt)}</span> : null}
                    {s.endsAt ? <span>until {dateTime(s.endsAt)}</span> : null}
                  </div>
                </div>
                <form action={toggleSpecial.bind(null, s.id, !s.active)}>
                  <button type="submit" className="min-h-11 rounded-sm border-2 border-outline bg-surface-2 px-3 text-sm font-bold">
                    {s.active ? 'Turn off' : 'Turn on'}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </Card>
    </AdminPage>
  );
}
