import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { AdminPage, Card } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { specials } from '@/lib/db/schema';
import { toLocalInput } from '@/lib/format';
import { deleteSpecial } from '../actions';
import { SpecialForm } from '../SpecialForm';

export default async function EditSpecial({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const isNew = id === 'new';
  if (!isNew && !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [s] = isNew ? [null] : await db.select().from(specials).where(eq(specials.id, id));
  if (!isNew && !s) notFound();

  return (
    <AdminPage title={isNew ? 'New special' : 'Edit special'} actions={<Link href="/admin/specials" className="font-bold underline">← Specials</Link>}>
      <Card>
        <SpecialForm
          id={s?.id ?? null}
          defaults={{
            title: s?.title ?? '',
            kicker: s?.kicker ?? '',
            body: s?.body ?? '',
            priceLabel: s?.priceLabel ?? '',
            startsAt: toLocalInput(s?.startsAt),
            endsAt: toLocalInput(s?.endsAt),
            sortOrder: s?.sortOrder ?? 0,
            active: s?.active ?? true,
          }}
        />
      </Card>
      {s ? (
        <form action={deleteSpecial.bind(null, s.id)}>
          <button type="submit" className="min-h-11 rounded-sm border-2 border-outline bg-danger-fill px-4 font-bold text-on-chile">
            Delete special
          </button>
        </form>
      ) : null}
    </AdminPage>
  );
}
