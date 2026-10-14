import type { Metadata } from 'next';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import { LinkButton } from '@/components/ui/Button';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { getMenu } from '@/lib/menu';
import { orderingState } from '@/lib/status';

export const metadata: Metadata = {
  title: 'Menu',
  description: 'Mexican-style burgers, bacon-wrapped hot dogs, loaded fries, elote and drinks. Prices and what’s sold out tonight.',
};

export default async function MenuPage() {
  const [menu, ordering] = await Promise.all([getMenu(), orderingState()]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading as="h1" size="h1" kicker="¿Qué se te antoja?">
          The menu
        </SectionHeading>
        {ordering.canOrder ? (
          <LinkButton href="/order" variant="primary">
            Order ahead · ~{ordering.waitMinutes} min
          </LinkButton>
        ) : null}
      </div>

      {/* Category jump links — sticky under the header on mobile. */}
      <nav aria-label="Menu sections" className="sticky top-0 z-20 -mx-4 mt-8 border-y-[length:var(--line-thin)] border-outline bg-bg/95 px-4 py-2 backdrop-blur-sm">
        <ul className="flex gap-2 overflow-x-auto">
          {menu.map((c) => (
            <li key={c.id} className="shrink-0">
              <a
                href={`#cat-${c.id}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-sm border-[length:var(--line-thin)] border-outline bg-surface px-3 text-sm font-bold no-underline hover:bg-marigold hover:text-on-marigold"
              >
                {c.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {menu.length === 0 ? (
        <p className="paper mt-10 p-6 text-lg">The menu is being updated. Check back soon!</p>
      ) : null}

      {menu.map((c) => (
        <section key={c.id} id={`cat-${c.id}`} aria-labelledby={`h-${c.id}`} className="scroll-mt-20 pt-12">
          <SectionHeading id={`h-${c.id}`} kicker={c.labelEs ?? undefined} underline="rosa" size="h2">
            {c.name}
          </SectionHeading>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {c.items.map((item, i) => (
              <li key={item.id}>
                <MenuItemCard item={item} index={i} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="mt-12 text-sm text-ink-muted">
        Prices don’t include tax; Texas sales tax is added at checkout. Food allergy? Tell us at the window or in your order note before we cook.
      </p>
    </div>
  );
}
