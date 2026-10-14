import { desc } from 'drizzle-orm';
import { AdminPage, Card, Empty, Pill, Stat } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { broadcasts, specials, subscribers } from '@/lib/db/schema';
import { maskEmail, maskPhone } from '@/lib/admin/subscribers';
import { dateTime, shortDate } from '@/lib/format';
import { emailActive, smsActive } from '@/lib/subscribers';
import { BroadcastComposer } from './BroadcastComposer';

export default async function SubscribersAdmin() {
  await requireAdmin();
  const [subs, sent, specialRows] = await Promise.all([
    db.select().from(subscribers).orderBy(desc(subscribers.createdAt)),
    db.select().from(broadcasts).orderBy(desc(broadcasts.createdAt)).limit(10),
    db.select({ id: specials.id, title: specials.title, active: specials.active }).from(specials).orderBy(desc(specials.createdAt)),
  ]);
  const emailCount = subs.filter(emailActive).length;
  const smsCount = subs.filter(smsActive).length;

  return (
    <AdminPage
      title="Subscribers"
      actions={
        <a href="/admin/subscribers/export" className="inline-flex min-h-11 items-center rounded-sm border-2 border-outline bg-surface px-3 font-bold no-underline">
          Download CSV
        </a>
      }
    >
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Email (active)" value={emailCount} />
        <Stat label="Text (active)" value={smsCount} />
        <Stat label="All signups" value={subs.length} hint="incl. unsubscribed" />
      </div>

      <Card title="Send a broadcast">
        <BroadcastComposer specials={specialRows.filter((s) => s.active).map(({ id, title }) => ({ id, title }))} />
      </Card>

      {sent.length > 0 ? (
        <Card title="Sent">
          <ul className="flex flex-col divide-y-2 divide-surface-2">
            {sent.map((b) => (
              <li key={b.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between">
                <span className="font-bold">{b.subject || b.body.slice(0, 60)}</span>
                <span className="text-sm text-ink-muted">
                  {b.sentAt ? dateTime(b.sentAt) : 'sending…'} · {b.emailCount} emails · {b.smsCount} texts
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title="List">
        {subs.length === 0 ? (
          <Empty>No subscribers yet. The signup page is /specials.</Empty>
        ) : (
          <ul className="flex flex-col divide-y-2 divide-surface-2">
            {subs.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:gap-4">
                <span className="min-w-0 flex-1 truncate">
                  {s.email ? maskEmail(s.email) : null}
                  {s.email && s.phone ? ' · ' : null}
                  {s.phone ? maskPhone(s.phone) : null}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {s.email ? <Pill tone={emailActive(s) ? 'green' : 'grey'}>{emailActive(s) ? 'Email' : 'Email off'}</Pill> : null}
                  {s.phone ? <Pill tone={smsActive(s) ? 'green' : 'grey'}>{smsActive(s) ? 'Text' : 'Text stopped'}</Pill> : null}
                </span>
                <span className="text-sm text-ink-muted">{shortDate(s.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AdminPage>
  );
}
