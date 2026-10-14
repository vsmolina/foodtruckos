import Link from 'next/link';
import type { GalleryCounts, GalleryPhotoDto, GalleryView, InstagramStatusDto, TakedownDto } from '@barrio/site-contract';
import { dateTime, shortDate } from '@/lib/format';
import { siteAsset, siteData, sitePage } from '@/lib/site/api';
import { ActionForm, FieldError } from '@/components/website/ActionForm';
import { Field, inputClass, NoticeBanner, PrimaryButton, QuietButton } from '@/components/dashboard/form';
import { Empty, Panel, Pill } from '@/components/website/ui';
import {
  approve,
  confirmConsent,
  connectInstagram,
  disconnectInstagram,
  dismissTakedown,
  refreshInstagram,
  reject,
  remove,
  resolveTakedown,
  restore,
  saveCaption,
  upload,
} from './actions';

export const dynamic = 'force-dynamic';

// Gallery moderation for "Night on the Square": nothing is public until it is
// approved, and approving needs a consent confirmation first (enforced by the
// website, mirrored here).

const VIEWS = [
  { key: 'pending', label: 'Pending', count: (c: GalleryCounts) => c.pending },
  { key: 'approved', label: 'On the site', count: (c: GalleryCounts) => c.approved },
  { key: 'removed', label: 'Removed', count: (c: GalleryCounts) => c.removed },
  { key: 'takedowns', label: 'Takedown requests', count: (c: GalleryCounts) => c.takedowns },
] as const;
type ViewKey = (typeof VIEWS)[number]['key'];

/** Success messages for actions that move a card out of view (actions.ts `moved`). */
const NOTICES: Record<string, string> = {
  approved: 'Approved — it’s on the website now.',
  rejected: 'Rejected. Find it under Removed if you change your mind.',
  removed: 'Taken off the website. Find it under Removed to restore it.',
  restored: 'Moved back to Pending.',
  resolved: 'Photo taken down and request closed.',
  dismissed: 'Request closed. Nothing was removed.',
  'ig-connected': 'Instagram connected. Your 3 latest posts are on the gallery page.',
  'ig-disconnected': 'Instagram disconnected. Its posts are off the gallery page.',
};

/** Same wording the website stores with the photo (lib/gallery/consent.ts ADMIN_CONSENT). */
const CONSENT_LABEL = 'Everyone identifiable in this photo agreed to have it published on the Barrio Burger Co. website and social media.';

export default async function WebsiteGalleryPage({ searchParams }: PageProps<'/website/gallery'>): Promise<React.JSX.Element> {
  const { view: raw, notice } = await searchParams;
  const noticeText = typeof notice === 'string' ? NOTICES[notice] : undefined;
  const view: ViewKey = VIEWS.find((v) => v.key === raw)?.key ?? 'pending';

  const [data, instagram] = await Promise.all([
    view === 'takedowns'
      ? siteData('gallery.takedowns', {}).then((d) => ({ kind: 'takedowns' as const, ...d }))
      : siteData('gallery.list', { view: view as GalleryView }).then((d) => ({ kind: 'photos' as const, ...d })),
    siteData('gallery.instagram', {}),
  ]);

  return (
    <div className="grid gap-6">
      {noticeText ? <NoticeBanner notice={{ tone: 'ok', text: noticeText }} /> : null}
      <nav aria-label="Gallery views" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => {
          const n = v.count(data.counts);
          const active = v.key === view;
          const urgent = (v.key === 'pending' || v.key === 'takedowns') && n > 0;
          return (
            <Link
              key={v.key}
              href={`/website/gallery?view=${v.key}`}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex items-center gap-2 rounded-[var(--radius)] border px-3 py-1.5 text-sm ${
                active ? 'border-[var(--ink)] bg-bg-raised font-medium text-ink' : 'border-[var(--rule)] text-ink-2 hover:bg-bg-sunken'
              }`}
            >
              {v.label}
              <span
                className={`rounded-full px-1.5 text-xs tabular-nums ${urgent ? 'bg-accent text-accent-ink' : 'bg-bg-sunken text-ink-3'}`}
                aria-label={`${n} ${urgent ? 'waiting' : ''}`.trim()}
              >
                {n}
              </span>
            </Link>
          );
        })}
        <a href={sitePage('/gallery')} target="_blank" rel="noreferrer" className="ml-auto self-center text-sm font-medium text-accent hover:underline">
          Public gallery ↗
        </a>
      </nav>

      {data.kind === 'takedowns' ? (
        <Takedowns requests={data.requests} />
      ) : (
        <Photos photos={data.photos} view={view as GalleryView} />
      )}

      {view === 'pending' ? <UploadPanel /> : null}

      <InstagramPanel ig={instagram} view={view} />
    </div>
  );
}

function Photos({ photos, view }: { photos: GalleryPhotoDto[]; view: GalleryView }): React.JSX.Element {
  if (photos.length === 0) {
    return (
      <Panel>
        <Empty>
          {view === 'pending' ? 'Nothing waiting for review.' : view === 'approved' ? 'No photos on the website yet.' : 'Nothing removed or rejected.'}
        </Empty>
      </Panel>
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {photos.map((p) => (
        <PhotoCard key={p.id} p={p} />
      ))}
    </ul>
  );
}

function Thumb({ p, className }: { p: GalleryPhotoDto; className: string }): React.JSX.Element {
  const src = siteAsset(p.url) ?? '';
  return (
    <a href={src} target="_blank" rel="noreferrer" className={`block overflow-hidden bg-bg-sunken ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote site asset; next/image would need the site host whitelisted */}
      <img src={src} alt={p.caption ?? 'Gallery photo'} loading="lazy" className="size-full object-cover" />
    </a>
  );
}

function PhotoCard({ p }: { p: GalleryPhotoDto }): React.JSX.Element {
  const live = p.status === 'approved';
  const off = p.status === 'removed' || p.status === 'rejected';
  return (
    <li className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--rule)] bg-bg-raised">
      <Thumb p={p} className="aspect-[4/3]" />
      <div className="flex flex-1 flex-col gap-3 p-4 text-sm">
        <div className="flex flex-wrap gap-1.5">
          <Pill tone={p.source === 'owner' ? 'neutral' : 'accent'}>{p.source === 'owner' ? 'Your upload' : 'Customer submitted'}</Pill>
          {p.consentConfirmed ? (
            <Pill tone="ok">Consent ✓ {p.consentBy === 'admin' ? '(you)' : '(submitter)'}</Pill>
          ) : (
            <Pill tone="warn">Consent needed</Pill>
          )}
          {live ? <Pill tone="ok">On the site</Pill> : null}
          {p.status === 'rejected' ? <Pill tone="danger">Rejected</Pill> : null}
          {p.status === 'removed' ? <Pill tone="neutral">Removed</Pill> : null}
        </div>

        {p.source === 'submission' ? (
          <p className="text-ink-2">
            {p.submitterName}
            {p.submitterEmail ? (
              <>
                {' · '}
                <a href={`mailto:${p.submitterEmail}`} className="break-all text-accent hover:underline">
                  {p.submitterEmail}
                </a>
              </>
            ) : null}
            {p.submitterInstagram ? ` · @${p.submitterInstagram}` : ''}
          </p>
        ) : null}
        <p className="text-xs text-ink-3">
          Added {dateTime(p.createdAt)} · <span className="break-all font-mono">id {p.id}</span>
        </p>

        <ActionForm action={saveCaption.bind(null, p.id)} className="flex flex-col gap-1">
          <div className="flex items-end gap-2">
            <Field label="Caption" className="min-w-0 flex-1">
              <input name="caption" defaultValue={p.caption ?? ''} maxLength={140} placeholder="Optional" className={inputClass} />
            </Field>
            <QuietButton>Save</QuietButton>
          </div>
          <FieldError name="caption" />
        </ActionForm>

        {!p.consentConfirmed && !off ? (
          <ActionForm action={confirmConsent.bind(null, p.id)} className="flex flex-col gap-2 rounded-[var(--radius)] border border-dashed border-[var(--warn)] p-3">
            <label className="flex items-start gap-2">
              <input type="checkbox" name="confirm" required className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
              <span className="text-ink-2">I confirm: {CONSENT_LABEL.charAt(0).toLowerCase() + CONSENT_LABEL.slice(1)}</span>
            </label>
            <FieldError name="confirm" />
            <div>
              <QuietButton>Confirm consent</QuietButton>
            </div>
          </ActionForm>
        ) : null}

        <div className="mt-auto flex flex-wrap items-start gap-2 border-t border-[var(--rule)] pt-3">
          {p.status === 'pending' ? (
            <>
              <ActionForm action={approve.bind(null, p.id)}>
                <button
                  type="submit"
                  disabled={!p.consentConfirmed}
                  aria-describedby={p.consentConfirmed ? undefined : `why-${p.id}`}
                  className="rounded-[var(--radius)] bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Approve
                </button>
              </ActionForm>
              <ActionForm action={reject.bind(null, p.id)}>
                <QuietButton>Reject</QuietButton>
              </ActionForm>
            </>
          ) : null}
          {live ? (
            <ActionForm action={remove.bind(null, p.id)}>
              <button
                type="submit"
                className="rounded-[var(--radius)] border border-[var(--danger)] px-3 py-1.5 text-sm font-medium text-danger hover:bg-[var(--danger)] hover:text-white"
              >
                Take off the site
              </button>
            </ActionForm>
          ) : null}
          {off ? (
            <ActionForm action={restore.bind(null, p.id)}>
              <QuietButton>Back to pending</QuietButton>
            </ActionForm>
          ) : null}
        </div>
        {p.status === 'pending' && !p.consentConfirmed ? (
          <p id={`why-${p.id}`} className="-mt-1 text-xs text-ink-3">
            Approve unlocks after consent is confirmed.
          </p>
        ) : null}
      </div>
    </li>
  );
}

function InstagramPanel({ ig, view }: { ig: InstagramStatusDto; view: ViewKey }): React.JSX.Element {
  if (!ig.connected) {
    return (
      <Panel title="Instagram posts" description="Connect your Instagram and the gallery page shows your 3 latest posts, each linking to the post on Instagram.">
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-ink-2">
          <li>Your Instagram must be a Professional account (Business or Creator: Instagram → Settings → Account type).</li>
          <li>
            At{' '}
            <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-accent hover:underline">
              developers.facebook.com/apps
            </a>
            , create an app and add the <strong>Instagram</strong> product.
          </li>
          <li>
            Under “API setup with Instagram login”, add your account and click <strong>Generate token</strong>.
          </li>
          <li>Paste the token below. It renews itself from then on.</li>
        </ol>
        <TokenForm label="Access token" button="Connect Instagram" view={view} />
      </Panel>
    );
  }
  return (
    <Panel
      title="Instagram posts"
      description={
        <>
          The gallery page shows the 3 latest posts from{' '}
          <a href={`https://instagram.com/${ig.username}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            @{ig.username}
          </a>
          . New posts show up on their own within about 30 minutes.
        </>
      }
    >
      <div className="grid gap-4">
        {ig.lastError ? (
          <p role="alert" className="rounded-[var(--radius)] border border-[var(--danger)] px-3 py-2 text-sm text-danger">
            {ig.lastError}
          </p>
        ) : null}
        {ig.posts.length ? (
          <ul className="grid gap-1 text-sm">
            {ig.posts.map((p) => (
              <li key={p.id}>
                <a href={p.permalink} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  {p.mediaType === 'VIDEO' ? 'Reel' : p.mediaType === 'CAROUSEL_ALBUM' ? 'Album' : 'Photo'} · {shortDate(p.postedAt)} ↗
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No posts pulled yet.</Empty>
        )}
        <p className="text-sm text-ink-2">
          {ig.oembed
            ? 'Shown with Instagram’s official embeds.'
            : 'Shown with Instagram’s standard embed code. Once Meta approves the app’s “oEmbed Read” review, the site switches to official embeds by itself.'}
        </p>
        <p className="text-xs text-ink-3">
          Last checked {ig.lastFetchedAt ? dateTime(ig.lastFetchedAt) : 'never'}
          {ig.tokenExpiresAt ? ` · token renews itself weekly (current one good until ${shortDate(ig.tokenExpiresAt)})` : ''}
        </p>
        <div className="flex flex-wrap items-start gap-2">
          <ActionForm action={refreshInstagram}>
            <QuietButton>Refresh now</QuietButton>
          </ActionForm>
          <ActionForm action={disconnectInstagram.bind(null, view)}>
            <button
              type="submit"
              className="rounded-[var(--radius)] border border-[var(--danger)] px-3 py-1.5 text-sm font-medium text-danger hover:bg-[var(--danger)] hover:text-white"
            >
              Disconnect
            </button>
          </ActionForm>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-ink-2">Use a new token</summary>
          <div className="mt-3">
            <TokenForm label="New access token" button="Reconnect" view={view} />
          </div>
        </details>
      </div>
    </Panel>
  );
}

function TokenForm({ label, button, view }: { label: string; button: string; view: ViewKey }): React.JSX.Element {
  return (
    <ActionForm action={connectInstagram.bind(null, view)} className="grid gap-3 sm:max-w-xl">
      <Field label={label}>
        <input name="accessToken" type="password" autoComplete="off" spellCheck={false} required className={`${inputClass} font-mono`} />
        <FieldError name="accessToken" />
      </Field>
      <div>
        <PrimaryButton>{button}</PrimaryButton>
      </div>
    </ActionForm>
  );
}

function UploadPanel(): React.JSX.Element {
  return (
    <Panel title="Upload your own photos" description="Uploads start in Pending. Approve each one to put it on the website.">
      <ActionForm action={upload} encType="multipart/form-data" className="grid gap-4 sm:max-w-xl">
        <Field label="Photos" hint="JPG, PNG or WebP, up to 8 MB each, 10 at a time.">
          <input
            name="photos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            required
            className="text-sm text-ink-2 file:mr-3 file:rounded-[var(--radius)] file:border file:border-[var(--rule)] file:bg-bg-raised file:px-3 file:py-1.5 file:text-sm file:text-ink"
          />
          <FieldError name="photos" />
        </Field>
        <Field label="Caption for all (optional)">
          <input name="caption" maxLength={140} className={inputClass} />
        </Field>
        <label className="flex items-start gap-2 text-sm text-ink-2">
          <input type="checkbox" name="consent" className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
          <span>
            {CONSENT_LABEL} <span className="text-ink-3">(Leave unticked to confirm each photo later.)</span>
          </span>
        </label>
        <div>
          <PrimaryButton>Upload</PrimaryButton>
        </div>
      </ActionForm>
    </Panel>
  );
}

function Takedowns({ requests }: { requests: TakedownDto[] }): React.JSX.Element {
  if (requests.length === 0) {
    return (
      <Panel>
        <Empty>No open takedown requests.</Empty>
      </Panel>
    );
  }
  return (
    <ul className="grid gap-4">
      {requests.map((r) => (
        <li key={r.id} className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--rule)] bg-bg-raised p-4 sm:flex-row">
          {r.photo ? <Thumb p={r.photo} className="h-32 w-full shrink-0 rounded-[var(--radius)] sm:w-40" /> : null}
          <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            <p className="font-medium text-ink">
              {r.name} ·{' '}
              <a href={`mailto:${r.email}`} className="break-all text-accent hover:underline">
                {r.email}
              </a>
            </p>
            <p className="text-xs text-ink-3">Requested {dateTime(r.createdAt)}</p>
            {r.photo ? (
              <p className="text-ink-2">
                Photo is <Pill tone={r.photo.status === 'approved' ? 'danger' : 'neutral'}>{r.photo.status === 'approved' ? 'on the site' : r.photo.status}</Pill>
              </p>
            ) : (
              <p className="text-ink-3">No photo linked. Find it under “On the site” and paste its id below.</p>
            )}
            {r.description ? <p className="text-ink-2">Which: {r.description}</p> : null}
            {r.reason ? <p className="text-ink-2">Reason: {r.reason}</p> : null}
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <ActionForm action={resolveTakedown.bind(null, r.id)} className="flex flex-wrap items-end gap-2">
                {r.photo ? null : (
                  <Field label="Photo id (optional)">
                    <input name="photoId" className={`${inputClass} w-72 max-w-full font-mono`} />
                    <FieldError name="photoId" />
                  </Field>
                )}
                <button
                  type="submit"
                  className="rounded-[var(--radius)] bg-[var(--danger)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  {r.photo ? 'Remove photo & close' : 'Close request'}
                </button>
              </ActionForm>
              <ActionForm action={dismissTakedown.bind(null, r.id)}>
                <QuietButton>Close without removing</QuietButton>
              </ActionForm>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
