import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteConfirm, NoticeBanner } from '@/components/dashboard/form';
import { siteApi, siteAsset } from '@/lib/site/api';
import { Panel } from '@/components/website/ui';
import { deleteSpecial } from '../actions';
import { SpecialForm } from '../SpecialForm';
import { StateLine } from '../StateLine';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditSpecialPage({ params, searchParams }: PageProps<'/website/specials/[id]'>): Promise<React.JSX.Element> {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const isNew = id === 'new';
  if (!isNew && !UUID.test(id)) notFound();

  let special = null;
  if (!isNew) {
    const r = await siteApi('specials.get', { id });
    if (!r.ok) {
      if (/no longer exists/i.test(r.error)) notFound();
      throw new Error(r.error);
    }
    special = r.data;
  }
  const photo = siteAsset(special?.photoUrl);
  const notice = sp.created
    ? { tone: 'ok' as const, text: 'Special created.' }
    : sp.error
      ? { tone: 'error' as const, text: 'Couldn’t delete it on the website. Try again.' }
      : null;

  return (
    <div className="grid max-w-3xl gap-4">
      <Link href="/website/specials" className="text-sm text-ink-2 hover:text-ink">
        ← Specials
      </Link>
      <Panel
        title={special ? special.title : 'New special'}
        {...(special ? {} : { description: 'Shows on Home and the Specials page while it’s live.' })}
        actions={
          special ? (
            <DeleteConfirm
              action={deleteSpecial.bind(null, special.id)}
              what="special"
              consequence="It disappears from the website right away. This can’t be undone."
            />
          ) : null
        }
      >
        {special ? <StateLine special={special} /> : null}
        <NoticeBanner notice={notice} />
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote website image preview
          <img src={photo} alt="Current photo" className="mb-4 mt-2 h-32 rounded-[var(--radius)] border border-[var(--rule)] object-cover" />
        ) : null}
        <div className="mt-2">
          <SpecialForm key={special?.id ?? 'new'} special={special} />
        </div>
      </Panel>
    </div>
  );
}
