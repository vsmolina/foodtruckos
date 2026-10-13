import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { AdminPage, Card, Stat } from '@/components/admin/ui';
import { buttonClass } from '@/components/ui/Button';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { partners } from '@/lib/db/schema';
import { money } from '@/lib/format';
import { referralQrSvg, referralUrl } from '@/lib/partners/qr';
import { partnerStats } from '@/lib/partners/stats';
import { removePartnerPhoto } from '../actions';
import { PartnerForm } from '../PartnerForm';

export const dynamic = 'force-dynamic';

export default async function EditPartnerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [p] = await db.select().from(partners).where(eq(partners.id, id)).limit(1);
  if (!p) notFound();
  const [stats, svg] = await Promise.all([partnerStats([p.id]), referralQrSvg(p.code)]);
  const s = stats.get(p.id)!;

  return (
    <AdminPage title={p.name} actions={<Link href="/admin/partners" className="font-bold underline">← Partners</Link>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Scans, last 30 days" value={s.visits30} />
        <Stat label="Orders credited" value={s.orders} />
        <Stat label="Revenue credited" value={money(s.revenueCents)} />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card title="Details">
          <PartnerForm partner={p} />
        </Card>
        <div className="flex flex-col gap-5">
          <Card title="QR code">
            <div className="mx-auto w-48 bg-white p-1" dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="mt-2 break-all text-center font-mono text-xs">{referralUrl(p.code)}</p>
            <Link href={`/admin/partners/${p.id}/qr`} className={buttonClass('marigold', 'sm', 'mt-3 w-full')}>
              Printable card
            </Link>
          </Card>
          {p.photoUrl ? (
            <Card title="Photo">
              <div className="relative aspect-[16/10] overflow-hidden border-2 border-outline">
                <Image src={p.photoUrl} alt={p.name} fill sizes="280px" className="object-cover" />
              </div>
              <form action={removePartnerPhoto} className="mt-2">
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" className="min-h-11 text-sm font-bold underline">
                  Remove photo
                </button>
              </form>
            </Card>
          ) : null}
        </div>
      </div>
    </AdminPage>
  );
}
