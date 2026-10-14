import Link from 'next/link';
import type { MenuItemDto } from '@barrio/site-contract';
import { dateTime, money } from '@/lib/format';
import { siteAsset, siteData } from '@/lib/site/api';
import { Empty, Panel, Pill } from '@/components/website/ui';
import { CategoryForm, CategoryHiddenToggle, FlagToggle, ItemForm, OpenOnHash, SyncButton } from './MenuForms';

export const dynamic = 'force-dynamic';

function priceRange(prices: MenuItemDto['prices']): string {
  if (prices.length === 0) return '—';
  const all = prices.map((p) => p.priceCents);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  return lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
}

function ItemRow({ item }: { item: MenuItemDto }): React.JSX.Element {
  const photo = siteAsset(item.photoUrl);
  return (
    <li id={item.squareId ? `sq-${item.squareId}` : `item-${item.id}`} className="scroll-mt-24 border-t border-[var(--rule)] py-3 first:border-t-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote website image, small thumb
            <img src={photo} alt="" className="size-12 shrink-0 rounded-[var(--radius)] border border-[var(--rule)] object-cover" />
          ) : (
            <div aria-hidden className="grid size-12 shrink-0 place-items-center rounded-[var(--radius)] border border-dashed border-[var(--rule)] text-[10px] text-ink-3">
              no photo
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className={`font-medium ${item.hidden ? 'text-ink-3 line-through' : 'text-ink'}`}>{item.name}</span>
              <span className="font-mono text-sm tabular-nums text-ink-2">{priceRange(item.prices)}</span>
            </div>
            {item.taglineEs ? <div className="text-sm italic text-ink-2">{item.taglineEs}</div> : null}
            <div className="mt-1 flex flex-wrap gap-1">
              {item.squareSoldOut ? <Pill tone="danger">Sold out in Square</Pill> : null}
              {item.squareId ? null : <Pill>Sample — not in Square</Pill>}
              {item.photoOverrideUrl ? <Pill tone="accent">Website photo</Pill> : item.squarePhotoUrl ? <Pill>Square photo</Pill> : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <FlagToggle id={item.id} flag="soldOut" on={item.soldOut} onLabel="Sold out" offLabel="Available" onTone="danger" />
          <FlagToggle id={item.id} flag="hidden" on={item.hidden} onLabel="Hidden" offLabel="Visible" onTone="neutral" />
          <FlagToggle id={item.id} flag="isNew" on={item.isNew} onLabel="NEW" offLabel="Not new" onTone="accent" />
        </div>
      </div>
      <details className="group mt-2 md:ml-15">
        <summary className="cursor-pointer list-none text-sm font-medium text-accent hover:underline">
          <span className="group-open:hidden">Photo, tagline &amp; order…</span>
          <span className="hidden group-open:inline">Close</span>
        </summary>
        <div className="mt-3 max-w-xl">
          <ItemForm id={item.id} taglineEs={item.taglineEs ?? ''} sortOrder={item.sortOrder} hasOverride={Boolean(item.photoOverrideUrl)} />
        </div>
      </details>
    </li>
  );
}

export default async function WebsiteMenuPage(): Promise<React.JSX.Element> {
  const menu = await siteData('menu.list', {});

  return (
    <div className="grid gap-6">
      <OpenOnHash />
      <Panel
        title="Menu extras"
        description={
          <>
            Names, descriptions, prices and sizes are edited under{' '}
            <Link href="/settings/menu" className="font-medium text-accent hover:underline">
              Menu
            </Link>
            . They go to Square, and the website picks them up automatically. Here you set what only the website has: photos,
            Spanish taglines, NEW stickers, and what’s hidden or sold out online.
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SyncButton disabled={!menu.squareConfigured} />
          <p className="text-sm text-ink-3">
            {menu.lastSyncedAt ? `Last synced ${dateTime(menu.lastSyncedAt)}.` : 'Never synced — showing sample items.'}{' '}
            {menu.squareConfigured ? 'Use this if a change in Square hasn’t shown up yet.' : 'Square isn’t configured on the website.'}
          </p>
        </div>
      </Panel>

      {menu.categories.length === 0 && menu.uncategorized.length === 0 ? (
        <Panel>
          <Empty>No menu on the website yet. Sync from Square.</Empty>
        </Panel>
      ) : null}

      {menu.categories.map((c) => (
        <Panel
          key={c.id}
          title={c.name}
          description={c.hidden ? 'Hidden — this whole category is off the website.' : `${c.items.length} item${c.items.length === 1 ? '' : 's'}`}
          actions={<CategoryHiddenToggle id={c.id} hidden={c.hidden} />}
        >
          <div className="mb-3">
            <CategoryForm id={c.id} labelEs={c.labelEs ?? ''} sortOrder={c.sortOrder} />
          </div>
          {c.items.length === 0 ? (
            <p className="text-sm text-ink-3">No items in this category.</p>
          ) : (
            <ul>
              {c.items.map((i) => (
                <ItemRow key={i.id} item={i} />
              ))}
            </ul>
          )}
        </Panel>
      ))}

      {menu.uncategorized.length ? (
        <Panel title="No category" description="These items’ category is gone; they don’t show on the website menu.">
          <ul>
            {menu.uncategorized.map((i) => (
              <ItemRow key={i.id} item={i} />
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
