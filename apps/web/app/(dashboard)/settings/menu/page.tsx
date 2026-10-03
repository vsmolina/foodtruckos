import Link from 'next/link';
import { getCatalogPulledAt, getMenu, type MenuCategory } from '@/lib/db/queries/menu';
import { DeleteConfirm, inputClass, NoticeBanner, PrimaryButton, QuietButton } from '@/components/dashboard/form';
import { RefreshWhilePending } from '@/components/dashboard/RefreshWhilePending';
import { SyncBadge } from '@/components/dashboard/SyncBadge';
import { dateTime, money } from '@/lib/format';
import { syncEnabled } from '@/lib/queue/square-sync';
import {
  createCategory,
  deleteCategory,
  moveCategory,
  pullFromSquare,
  pushAllToSquare,
  renameCategory,
} from './actions';
import { noticeFor } from './notices';

export const dynamic = 'force-dynamic';

function priceRange(variations: MenuCategory['items'][number]['variations']): string {
  if (variations.length === 0) return '—';
  const prices = variations.map((v) => v.priceCents);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
}

function CategorySection({
  category,
  isFirst,
  isLast,
  showSync,
}: {
  category: MenuCategory;
  isFirst: boolean;
  isLast: boolean;
  showSync: boolean;
}): React.JSX.Element {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--rule)] bg-bg-raised">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--rule)] px-4 py-2.5">
        <form action={renameCategory.bind(null, category.id)} className="flex min-w-0 flex-1 items-center gap-2">
          <input
            name="name"
            defaultValue={category.name}
            required
            maxLength={80}
            aria-label="Category name"
            className={`${inputClass} max-w-xs font-display !text-lg`}
          />
          <QuietButton>Rename</QuietButton>
        </form>
        {showSync ? <SyncBadge status={category.syncStatus} error={category.syncError} /> : null}
        <div className="flex items-center">
          {!isFirst ? (
            <form action={moveCategory.bind(null, category.id, 'up')}>
              <QuietButton label={`Move ${category.name} up`}>↑</QuietButton>
            </form>
          ) : null}
          {!isLast ? (
            <form action={moveCategory.bind(null, category.id, 'down')}>
              <QuietButton label={`Move ${category.name} down`}>↓</QuietButton>
            </form>
          ) : null}
          {category.items.length === 0 ? (
            <DeleteConfirm
              action={deleteCategory.bind(null, category.id)}
              what="category"
              consequence="It has no items. This can’t be undone."
            />
          ) : null}
        </div>
      </div>

      {category.items.length === 0 ? (
        <p className="px-4 py-3 text-sm text-ink-3">No items yet.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {category.items.map((item) => (
              <tr key={item.id} className="border-b border-[var(--rule)] last:border-0 hover:bg-bg-sunken">
                <td className="px-4 py-2.5">
                  <Link href={`/settings/menu/items/${item.id}`} className="font-medium text-ink hover:text-accent">
                    {item.name}
                  </Link>
                  {!item.isAvailable ? (
                    <span className="ml-2 rounded-[var(--radius-sm)] border border-[var(--rule)] px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-ink-3">
                      Unavailable
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-ink-3">
                  {item.variations.length > 1 ? `${item.variations.length} sizes` : null}
                  {item.variations.length > 1 && item.modifierCount > 0 ? ' · ' : null}
                  {item.modifierCount > 0
                    ? `${item.modifierCount} modifier${item.modifierCount === 1 ? '' : 's'}`
                    : null}
                </td>
                {showSync ? (
                  <td className="px-4 py-2.5 text-right">
                    <SyncBadge status={item.syncStatus} error={item.syncError} />
                  </td>
                ) : null}
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-ink">
                  {priceRange(item.variations)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="border-t border-[var(--rule)] px-4 py-2">
        <Link
          href={`/settings/menu/items/new?category=${category.id}`}
          className="text-sm text-ink-2 hover:text-accent"
        >
          + Add item
        </Link>
      </div>
    </section>
  );
}

export default async function MenuSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<React.JSX.Element> {
  const [menu, pulledAt, sp] = await Promise.all([getMenu(), getCatalogPulledAt(), searchParams]);
  const sync = syncEnabled();
  const all = [...menu, ...menu.flatMap((c) => c.items)];
  const pending = all.some((x) => x.syncStatus === 'pending');
  const unsynced = all.filter((x) => x.syncStatus === 'local' || x.syncStatus === 'error').length;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl text-ink">Menu</h1>
      {sync ? (
        <>
          <p className="mt-1 max-w-xl text-sm text-ink-3">
            Saving sends the change to Square, and the POS picks it up within seconds. Edited something on the
            POS or in the Square dashboard? Pull from Square first — the last save wins.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <form action={pullFromSquare}>
              <PrimaryButton>Pull from Square</PrimaryButton>
            </form>
            {unsynced > 0 ? (
              <form action={pushAllToSquare}>
                <QuietButton>
                  Send {unsynced} unsynced {unsynced === 1 ? 'change' : 'changes'} to Square
                </QuietButton>
              </form>
            ) : null}
            <span className="text-xs text-ink-3">
              {pulledAt ? `Last pulled ${dateTime(pulledAt)}` : 'Never pulled from Square'}
            </span>
          </div>
        </>
      ) : (
        <p className="mt-1 max-w-xl text-sm text-ink-3">
          Square sync is off (mock mode or no Square credentials) — edits change this app’s menu only.
        </p>
      )}
      <NoticeBanner notice={noticeFor(sp.notice)} />
      <RefreshWhilePending active={pending} />

      <div className="mt-6 flex flex-col gap-5">
        {menu.length === 0 ? <p className="text-sm text-ink-3">No categories yet. Add one below.</p> : null}
        {menu.map((c, i) => (
          <CategorySection
            key={c.id}
            category={c}
            isFirst={i === 0}
            isLast={i === menu.length - 1}
            showSync={sync}
          />
        ))}
      </div>

      <form action={createCategory} className="mt-8 flex max-w-md items-end gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ink-3">New category</span>
          <input name="name" required maxLength={80} placeholder="e.g. Desserts" className={inputClass} />
        </label>
        <PrimaryButton>Add category</PrimaryButton>
      </form>
    </div>
  );
}
