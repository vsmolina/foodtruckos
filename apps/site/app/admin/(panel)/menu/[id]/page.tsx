import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { AdminPage, Card } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { menuItems, menuModifiers, menuVariations } from '@/lib/db/schema';
import { price } from '@/lib/format';
import { ItemForm } from './ItemForm';

export default async function MenuItemAdmin({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [item] = await db.select().from(menuItems).where(eq(menuItems.id, id));
  if (!item) notFound();
  const [vars, mods] = await Promise.all([
    db.select().from(menuVariations).where(eq(menuVariations.itemId, id)),
    db.select().from(menuModifiers).where(eq(menuModifiers.itemId, id)),
  ]);
  const photo = item.photoOverrideUrl ?? item.photoUrl;

  return (
    <AdminPage title={item.name} actions={<Link href="/admin/menu" className="font-bold underline">← Menu</Link>}>
      <Card title="From Square (edit in the Square Dashboard)">
        <p className="text-ink-muted">{item.description ?? 'No description.'}</p>
        <p className="mt-2 font-bold">{vars.map((v) => `${v.name} ${price(v.priceCents)}`).join(' · ')}</p>
        {mods.length ? <p className="mt-1 text-sm text-ink-muted">Options: {mods.map((m) => m.name).join(', ')}</p> : null}
      </Card>
      <Card title="Website">
        {photo ? (
          <div className="relative mb-4 aspect-[16/10] max-w-sm overflow-hidden rounded-md border-2 border-outline">
            <Image src={photo} alt="" fill sizes="384px" className="object-cover" />
          </div>
        ) : null}
        <ItemForm id={item.id} taglineEs={item.taglineEs ?? ''} sortOrder={item.sortOrder} hasOverride={Boolean(item.photoOverrideUrl)} />
      </Card>
    </AdminPage>
  );
}
