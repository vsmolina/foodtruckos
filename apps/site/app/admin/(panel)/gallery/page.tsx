import Image from 'next/image';
import Link from 'next/link';
import { and, count, desc, eq } from 'drizzle-orm';
import { AdminPage, Card, Empty, Pill } from '@/components/admin/ui';
import { buttonClass } from '@/components/ui/Button';
import { requireAdmin } from '@/lib/auth';
import { cx } from '@/lib/cx';
import { db } from '@/lib/db/client';
import { galleryPhotos, takedownRequests } from '@/lib/db/schema';
import { dateTime } from '@/lib/format';
import {
  approvePhoto,
  confirmConsent,
  dismissTakedown,
  rejectPhoto,
  removePhoto,
  resolveTakedown,
  restoreToPending,
} from './actions';
import { OwnerUpload } from './OwnerUpload';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'removed', label: 'Removed' },
  { key: 'takedowns', label: 'Takedowns' },
] as const;
type Tab = (typeof TABS)[number]['key'];

export default async function AdminGalleryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab: rawTab } = await searchParams;
  const tab: Tab = (TABS.find((t) => t.key === rawTab)?.key ?? 'pending') as Tab;

  const [[pendingCount], [openTakedowns]] = await Promise.all([
    db.select({ n: count() }).from(galleryPhotos).where(eq(galleryPhotos.status, 'pending')),
    db.select({ n: count() }).from(takedownRequests).where(eq(takedownRequests.status, 'open')),
  ]);
  const badge: Partial<Record<Tab, number>> = { pending: pendingCount?.n ?? 0, takedowns: openTakedowns?.n ?? 0 };

  return (
    <AdminPage title="Gallery">
      <nav aria-label="Gallery tabs" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/gallery?tab=${t.key}`}
            aria-current={tab === t.key ? 'page' : undefined}
            className={cx(
              'inline-flex min-h-11 items-center gap-2 rounded-sm border-2 border-outline px-3 text-sm font-bold no-underline',
              tab === t.key ? 'bg-marigold text-on-marigold' : 'bg-surface',
            )}
          >
            {t.label}
            {badge[t.key] ? <span className="rounded-full bg-chile px-1.5 text-xs text-on-chile">{badge[t.key]}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === 'takedowns' ? <Takedowns /> : <Photos tab={tab} />}

      {tab === 'pending' ? (
        <Card title="Upload your own photos">
          <p className="mb-3 text-sm text-ink-muted">
            Your uploads start as pending. Before publishing, confirm that everyone identifiable in each photo agreed to be posted.
          </p>
          <OwnerUpload />
        </Card>
      ) : null}
    </AdminPage>
  );
}

async function Photos({ tab }: { tab: Exclude<Tab, 'takedowns'> }) {
  const status = tab === 'removed' ? 'removed' : tab;
  const rows = await db
    .select()
    .from(galleryPhotos)
    .where(tab === 'removed' ? eq(galleryPhotos.status, 'removed') : eq(galleryPhotos.status, status))
    .orderBy(desc(galleryPhotos.createdAt))
    .limit(200);
  const rejected =
    tab === 'removed'
      ? await db.select().from(galleryPhotos).where(eq(galleryPhotos.status, 'rejected')).orderBy(desc(galleryPhotos.createdAt)).limit(100)
      : [];
  const all = [...rows, ...rejected];
  if (all.length === 0) {
    return <Empty>{tab === 'pending' ? 'Nothing waiting for review.' : tab === 'approved' ? 'No published photos yet.' : 'Nothing removed or rejected.'}</Empty>;
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {all.map((p) => (
        <li key={p.id} className="flex flex-col overflow-hidden rounded-md border-2 border-outline bg-surface">
          <a href={p.url} target="_blank" rel="noopener" className="relative block aspect-[4/3] bg-surface-2">
            <Image src={p.url} alt={p.caption ?? 'Gallery photo'} fill sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
          </a>
          <div className="flex flex-1 flex-col gap-2 p-3 text-sm">
            <div className="flex flex-wrap gap-1.5">
              <Pill tone={p.source === 'owner' ? 'blue' : 'pink'}>{p.source === 'owner' ? 'Your upload' : 'Submitted'}</Pill>
              {p.consentConfirmed ? <Pill tone="green">Consent ✓ ({p.consentBy})</Pill> : <Pill tone="amber">Consent needed</Pill>}
              {p.status === 'rejected' ? <Pill tone="red">Rejected</Pill> : null}
            </div>
            {p.caption ? <p className="font-bold">“{p.caption}”</p> : null}
            {p.source === 'submission' ? (
              <p className="text-ink-muted">
                {p.submitterName} · {p.submitterEmail}
                {p.submitterInstagram ? ` · @${p.submitterInstagram}` : ''}
              </p>
            ) : null}
            <p className="text-ink-muted">
              {dateTime(p.createdAt)} · <span className="break-all font-mono text-xs">id {p.id}</span>
            </p>

            {!p.consentConfirmed && p.status !== 'removed' && p.status !== 'rejected' ? (
              <form action={confirmConsent} className="flex flex-col gap-2 rounded-sm border-2 border-dashed border-outline p-2">
                <input type="hidden" name="id" value={p.id} />
                <label className="flex min-h-11 items-start gap-2">
                  <input type="checkbox" name="confirm" value="yes" required className="mt-1 h-5 w-5 shrink-0" />
                  <span>I confirm everyone identifiable in this photo consented to it being published.</span>
                </label>
                <button type="submit" className={buttonClass('paper', 'sm', 'self-start')}>
                  Confirm consent
                </button>
              </form>
            ) : null}

            <div className="mt-auto flex flex-wrap gap-2 pt-1">
              {p.status === 'pending' ? (
                <>
                  <form action={approvePhoto}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      disabled={!p.consentConfirmed}
                      aria-describedby={p.consentConfirmed ? undefined : `why-${p.id}`}
                      className={buttonClass('agave', 'sm')}
                    >
                      Approve
                    </button>
                  </form>
                  <form action={rejectPhoto}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className={buttonClass('paper', 'sm')}>
                      Reject
                    </button>
                  </form>
                </>
              ) : null}
              {p.status === 'approved' ? (
                <form action={removePhoto}>
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className={buttonClass('danger', 'sm')}>
                    Remove from site
                  </button>
                </form>
              ) : null}
              {p.status === 'removed' || p.status === 'rejected' ? (
                <form action={restoreToPending}>
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className={buttonClass('paper', 'sm')}>
                    Back to pending
                  </button>
                </form>
              ) : null}
            </div>
            {p.status === 'pending' && !p.consentConfirmed ? (
              <p id={`why-${p.id}`} className="text-xs text-ink-muted">
                Approve unlocks after consent is confirmed.
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

async function Takedowns() {
  const rows = await db
    .select({ req: takedownRequests, photo: galleryPhotos })
    .from(takedownRequests)
    .leftJoin(galleryPhotos, eq(takedownRequests.photoId, galleryPhotos.id))
    .where(and(eq(takedownRequests.status, 'open')))
    .orderBy(desc(takedownRequests.createdAt));
  if (rows.length === 0) return <Empty>No open takedown requests.</Empty>;
  return (
    <ul className="flex flex-col gap-4">
      {rows.map(({ req, photo }) => (
        <li key={req.id} className="flex flex-col gap-3 rounded-md border-2 border-outline bg-surface p-4 sm:flex-row">
          {photo ? (
            <a href={photo.url} target="_blank" rel="noopener" className="relative block h-32 w-full shrink-0 overflow-hidden border-2 border-outline bg-surface-2 sm:w-40">
              <Image src={photo.url} alt="Requested photo" fill sizes="160px" className="object-cover" />
            </a>
          ) : null}
          <div className="flex flex-1 flex-col gap-1 text-sm">
            <p className="font-bold">
              {req.name} · <a href={`mailto:${req.email}`} className="underline">{req.email}</a>
            </p>
            <p className="text-ink-muted">{dateTime(req.createdAt)}</p>
            {photo ? <p>Photo status: <Pill tone={photo.status === 'approved' ? 'red' : 'grey'}>{photo.status}</Pill></p> : <p className="text-ink-muted">No photo linked — find it in Approved and paste its id below.</p>}
            {req.description ? <p>Which: {req.description}</p> : null}
            {req.reason ? <p>Reason: {req.reason}</p> : null}
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <form action={resolveTakedown} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={req.id} />
                {photo ? null : (
                  <label className="flex flex-col gap-1 text-xs font-bold">
                    Photo id
                    <input name="photoId" placeholder="optional" className="min-h-11 rounded-sm border-2 border-outline bg-paper px-2 text-paper-ink" />
                  </label>
                )}
                <button type="submit" className={buttonClass('danger', 'sm')}>
                  {photo ? 'Remove photo & resolve' : 'Resolve'}
                </button>
              </form>
              <form action={dismissTakedown}>
                <input type="hidden" name="id" value={req.id} />
                <button type="submit" className={buttonClass('paper', 'sm')}>
                  Close without removing
                </button>
              </form>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
