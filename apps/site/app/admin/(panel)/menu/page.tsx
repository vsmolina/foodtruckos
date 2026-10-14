import Link from 'next/link';
import { asc, max } from 'drizzle-orm';
import { AdminPage, Card, Empty, Pill } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth';
import { cx } from '@/lib/cx';
import { db } from '@/lib/db/client';
import { menuCategories, menuItems, menuVariations } from '@/lib/db/schema';
import { has } from '@/lib/env';
import { dateTime, price } from '@/lib/format';
import { saveCategory, toggleCategoryHidden, toggleItemFlag } from './actions';
import { SyncButton } from './SyncButton';

export default async function MenuAdminPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin();
  const { saved } = await searchParams;
  const [cats, items, vars, [lastSync]] = await Promise.all([
    db.select().from(menuCategories).orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name)),
    db.select().from(menuItems).orderBy(asc(menuItems.sortOrder), asc(menuItems.name)),
    db.select().from(menuVariations).orderBy(asc(menuVariations.priceCents)),
    db.select({ at: max(menuItems.syncedAt) }).from(menuItems),
  ]);
  const varsByItem = Map.groupBy(vars, (v) => v.itemId);
  const byCat = Map.groupBy(items, (i) => i.categoryId ?? 'none');

  return (
    <AdminPage title="Menu">
      {saved ? <p className="rounded-md border-2 border-outline bg-agave p-3 font-bold text-on-agave">Saved.</p> : null}
      <Card title="Square">
        <p className="mb-3 text-sm text-ink-muted">
          Names, descriptions, prices and sizes come from Square — edit them in the Square Dashboard, then sync.{' '}
          {lastSync?.at ? `Last synced ${dateTime(lastSync.at)}.` : 'Not synced yet (showing sample items).'} Sold out, hidden, NEW,
          Spanish labels and website photos are set here.
        </p>
        <SyncButton disabled={!has.square} />
        {has.square ? null : <p className="mt-2 text-sm font-bold text-warning">Square isn’t configured (SQUARE_ACCESS_TOKEN etc.).</p>}
      </Card>

      {cats.length === 0 ? <Empty>No menu yet. Sync from Square.</Empty> : null}

      {cats.map((c) => (
        <Card
          key={c.id}
          title={
            <span className="flex flex-wrap items-center gap-2">
              {c.name}
              {c.hidden ? <Pill tone="grey">Hidden</Pill> : null}
            </span>
          }
        >
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <form action={saveCategory} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={c.id} />
              <label className="flex flex-col text-sm font-bold">
                Spanish label
                <input name="labelEs" defaultValue={c.labelEs ?? ''} maxLength={40} className="mt-1 min-h-11 rounded-sm border-2 border-outline bg-paper px-2 text-paper-ink" />
              </label>
              <label className="flex flex-col text-sm font-bold">
                Order
                <input name="sortOrder" type="number" min={0} defaultValue={c.sortOrder} className="mt-1 min-h-11 w-20 rounded-sm border-2 border-outline bg-paper px-2 text-paper-ink" />
              </label>
              <button type="submit" className="min-h-11 rounded-sm border-2 border-outline bg-surface-2 px-3 text-sm font-bold">
                Save
              </button>
            </form>
            <form action={toggleCategoryHidden.bind(null, c.id, !c.hidden)}>
              <button type="submit" className="min-h-11 rounded-sm border-2 border-outline bg-surface-2 px-3 text-sm font-bold">
                {c.hidden ? 'Show category' : 'Hide category'}
              </button>
            </form>
          </div>
          <ul>
            {(byCat.get(c.id) ?? []).map((i) => {
              const v = varsByItem.get(i.id) ?? [];
              return (
                <li key={i.id} className="flex flex-col gap-2 border-t-2 border-surface-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Link href={`/admin/menu/${i.id}`} className="font-bold underline">
                      {i.name}
                    </Link>
                    <span className="ml-2 text-sm text-ink-muted">{v.map((x) => `${x.name} ${price(x.priceCents)}`).join(' · ')}</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {i.squareSoldOut ? <Pill tone="red">Sold out in Square</Pill> : null}
                      {i.squareId ? null : <Pill tone="grey">Sample / not in Square</Pill>}
                      {i.photoOverrideUrl || i.photoUrl ? <Pill tone="blue">Photo</Pill> : null}
                      {i.taglineEs ? <Pill tone="pink">{i.taglineEs}</Pill> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Toggle on={i.soldOut} action={toggleItemFlag.bind(null, i.id, 'soldOut', !i.soldOut)} onLabel="Sold out" offLabel="Available" onTone="bg-danger-fill text-on-chile" />
                    <Toggle on={i.hidden} action={toggleItemFlag.bind(null, i.id, 'hidden', !i.hidden)} onLabel="Hidden" offLabel="Visible" onTone="bg-surface-2 text-ink" />
                    <Toggle on={i.isNew} action={toggleItemFlag.bind(null, i.id, 'isNew', !i.isNew)} onLabel="NEW" offLabel="Not new" onTone="bg-rosa text-on-rosa" />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </AdminPage>
  );
}

function Toggle({ on, action, onLabel, offLabel, onTone }: { on: boolean; action: () => Promise<void>; onLabel: string; offLabel: string; onTone: string }) {
  return (
    <form action={action}>
      <button
        type="submit"
        aria-pressed={on}
        className={cx('min-h-11 min-w-24 rounded-sm border-2 border-outline px-3 text-sm font-bold', on ? onTone : 'bg-surface text-ink-muted')}
      >
        {on ? onLabel : offLabel}
      </button>
    </form>
  );
}
