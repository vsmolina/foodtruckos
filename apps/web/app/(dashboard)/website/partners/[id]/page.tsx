import Link from 'next/link';
import { notFound } from 'next/navigation';
import { money } from '@/lib/format';
import { siteApi, siteAsset, SiteUnavailableError } from '@/lib/site/api';
import { ActionForm } from '@/components/website/ActionForm';
import { DeleteConfirm, NoticeBanner, QuietButton } from '@/components/dashboard/form';
import { ButtonLink, Panel, Pill } from '@/components/website/ui';
import { deletePartner, removePhoto } from '../actions';
import { PartnerForm } from '../PartnerForm';

export const dynamic = 'force-dynamic';

export default async function EditPartnerPage({ params, searchParams }: PageProps<'/website/partners/[id]'>): Promise<React.JSX.Element> {
  const { id } = await params;
  const { created, error, photo: photoNotice } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const result = await siteApi('partners.qr', { id });
  if (!result.ok) {
    if (result.fieldErrors || /no longer exists/.test(result.error)) notFound();
    throw new SiteUnavailableError(result.error);
  }
  const { partner: p, svg } = result.data;
  const photo = siteAsset(p.photoUrl);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/website/partners" className="text-sm text-ink-2 hover:text-ink">
          ← Partners
        </Link>
        <DeleteConfirm
          action={deletePartner.bind(null, p.id)}
          what="partner"
          consequence="Their link and QR stop working and their scan history is deleted. Credited orders stay but lose the credit. To pause them instead, untick Active."
        />
      </div>
      {created ? <NoticeBanner notice={{ tone: 'ok', text: 'Partner added. Print their QR card below.' }} /> : null}
      {photoNotice === 'removed' ? <NoticeBanner notice={{ tone: 'ok', text: 'Photo removed.' }} /> : null}
      {error === 'delete' ? <NoticeBanner notice={{ tone: 'error', text: 'Couldn’t delete the partner. Try again.' }} /> : null}

      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-2xl text-ink">{p.name}</h2>
        {p.active ? <Pill tone="ok">Active</Pill> : <Pill>Inactive</Pill>}
      </div>

      <dl className="grid grid-cols-3 gap-4">
        {[
          ['Scans, last 30 days', String(p.stats.visits30)],
          ['Orders credited', String(p.stats.orders)],
          ['Revenue credited', money(p.stats.revenueCents)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[var(--radius-lg)] border border-[var(--rule)] bg-bg-raised p-4">
            <dt className="text-sm text-ink-2">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink sm:text-3xl">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Panel title="Details">
          <PartnerForm partner={p} />
        </Panel>
        <div className="grid content-start gap-6">
          <Panel title="QR code">
            <div className="mx-auto w-44 bg-white p-1" dangerouslySetInnerHTML={{ __html: svg }} />
            <a href={p.referralUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all text-center font-mono text-xs text-accent hover:underline">
              {p.referralUrl}
            </a>
            <div className="mt-3 flex justify-center">
              <ButtonLink href={`/website/partners/${p.id}/qr`}>Printable card</ButtonLink>
            </div>
          </Panel>
          {photo ? (
            <Panel title="Photo">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote site asset */}
              <img src={photo} alt={p.name} className="aspect-[16/10] w-full rounded-[var(--radius)] object-cover" />
              <ActionForm action={removePhoto.bind(null, p.id)} className="mt-2">
                <QuietButton>Remove photo</QuietButton>
              </ActionForm>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
