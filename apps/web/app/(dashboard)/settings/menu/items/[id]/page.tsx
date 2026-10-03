import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategories, getMenuItem } from '@/lib/db/queries/menu';
import {
  DeleteConfirm,
  Field,
  inputClass,
  NoticeBanner,
  PrimaryButton,
  QuietButton,
} from '@/components/dashboard/form';
import { RefreshWhilePending } from '@/components/dashboard/RefreshWhilePending';
import { SyncBadge } from '@/components/dashboard/SyncBadge';
import { dollarsInput } from '@/lib/format';
import { syncEnabled } from '@/lib/queue/square-sync';
import {
  addModifier,
  addVariation,
  deleteItem,
  deleteModifier,
  deleteVariation,
  retryItemSync,
  setDefaultVariation,
  updateItem,
  updateModifier,
  updateVariation,
} from '../../actions';
import { noticeFor } from '../../notices';

export const dynamic = 'force-dynamic';

const PRICE_PATTERN = '\\$?\\d{1,5}(\\.\\d{1,2})?';
const DELTA_PATTERN = '-?\\$?\\d{1,5}(\\.\\d{1,2})?';
const priceInput = `${inputClass} w-24 font-mono tabular-nums`;

function SectionTitle({ title, hint }: { title: string; hint: string }): React.JSX.Element {
  return (
    <div className="mb-3">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <p className="text-xs text-ink-3">{hint}</p>
    </div>
  );
}

export default async function EditMenuItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<React.JSX.Element> {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [item, categories] = await Promise.all([getMenuItem(id), getCategories()]);
  if (!item) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/settings/menu" className="text-sm text-ink-2 hover:text-ink">
        ← Menu
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-2xl text-ink">{item.name}</h1>
        {syncEnabled() ? <SyncBadge status={item.syncStatus} error={item.syncError} /> : null}
      </div>
      {syncEnabled() && item.syncStatus === 'error' ? (
        <div className="mt-2 flex max-w-[640px] items-start justify-between gap-4 border-l-2 border-[var(--danger)] px-3 py-1.5 text-sm">
          <span className="text-danger">Square rejected the last change: {item.syncError ?? 'unknown error'}</span>
          <form action={retryItemSync.bind(null, item.id)}>
            <QuietButton>Retry</QuietButton>
          </form>
        </div>
      ) : null}
      <NoticeBanner notice={noticeFor(sp.notice)} />
      <RefreshWhilePending active={item.syncStatus === 'pending'} />

      {/* Details */}
      <form action={updateItem.bind(null, item.id)} className="mt-6 flex max-w-[640px] flex-col gap-5">
        <Field label="Name">
          <input name="name" defaultValue={item.name} required maxLength={80} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-6">
          <Field label="Category">
            <select name="categoryId" defaultValue={item.categoryId} className={inputClass}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="SKU" hint="Optional.">
            <input name="sku" defaultValue={item.sku ?? ''} maxLength={40} className={`${inputClass} font-mono`} />
          </Field>
        </div>
        <Field label="Description" hint="Optional.">
          <textarea
            name="description"
            defaultValue={item.description ?? ''}
            rows={2}
            maxLength={500}
            className={`${inputClass} resize-y`}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="isAvailable"
            defaultChecked={item.isAvailable}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Available — uncheck to hide it without deleting (e.g. sold out for the season).
        </label>
        <div>
          <PrimaryButton>Save details</PrimaryButton>
        </div>
      </form>

      {/* Variations */}
      <section className="mt-10 max-w-[640px]">
        <SectionTitle title="Sizes & prices" hint="Every item needs at least one. The default is what a plain order gets." />
        <ul className="flex flex-col divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
          {item.variations.map((v) => (
            <li key={v.id} className="flex items-center gap-3 py-2">
              <form action={updateVariation.bind(null, v.id)} className="flex flex-1 items-center gap-3">
                <input
                  name="name"
                  defaultValue={v.name}
                  required
                  maxLength={80}
                  aria-label="Size name"
                  className={`${inputClass} flex-1`}
                />
                <span className="text-sm text-ink-3">$</span>
                <input
                  name="price"
                  defaultValue={dollarsInput(v.priceCents)}
                  required
                  inputMode="decimal"
                  pattern={PRICE_PATTERN}
                  aria-label="Price in dollars"
                  className={priceInput}
                />
                <QuietButton>Save</QuietButton>
              </form>
              {v.isDefault ? (
                <span className="w-28 text-center text-xs uppercase tracking-wide text-ink-3">Default</span>
              ) : (
                <form action={setDefaultVariation.bind(null, v.id)} className="w-28 text-center">
                  <QuietButton>Make default</QuietButton>
                </form>
              )}
              {item.variations.length > 1 ? (
                <DeleteConfirm
                  action={deleteVariation.bind(null, v.id)}
                  what="size"
                  consequence={v.isDefault ? 'The cheapest remaining size becomes the default.' : 'This can’t be undone.'}
                />
              ) : (
                <span className="w-[3.75rem]" />
              )}
            </li>
          ))}
        </ul>
        <form action={addVariation.bind(null, item.id)} className="mt-3 flex items-end gap-3">
          <Field label="New size" className="flex-1">
            <input name="name" required maxLength={80} placeholder="e.g. Large" className={inputClass} />
          </Field>
          <Field label="Price">
            <input name="price" required inputMode="decimal" pattern={PRICE_PATTERN} placeholder="13.99" className={priceInput} />
          </Field>
          <PrimaryButton>Add size</PrimaryButton>
        </form>
      </section>

      {/* Modifiers */}
      <section className="mt-10 max-w-[640px]">
        <SectionTitle title="Modifiers" hint="Add-ons and changes. Use a negative price for discounts, e.g. -0.50." />
        {item.modifiers.length === 0 ? (
          <p className="border-y border-[var(--rule)] py-3 text-sm text-ink-3">No modifiers.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
            {item.modifiers.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2">
                <form action={updateModifier.bind(null, m.id)} className="flex flex-1 items-center gap-3">
                  <input
                    name="name"
                    defaultValue={m.name}
                    required
                    maxLength={80}
                    aria-label="Modifier name"
                    className={`${inputClass} flex-1`}
                  />
                  <span className="text-sm text-ink-3">$</span>
                  <input
                    name="price"
                    defaultValue={dollarsInput(m.priceCentsDelta)}
                    required
                    inputMode="decimal"
                    pattern={DELTA_PATTERN}
                    aria-label="Price change in dollars"
                    className={priceInput}
                  />
                  <label className="flex items-center gap-1.5 text-xs text-ink-2">
                    <input
                      type="checkbox"
                      name="isRequired"
                      defaultChecked={m.isRequired}
                      className="h-3.5 w-3.5 accent-[var(--accent)]"
                    />
                    Required
                  </label>
                  <QuietButton>Save</QuietButton>
                </form>
                <DeleteConfirm
                  action={deleteModifier.bind(null, m.id)}
                  what="modifier"
                  consequence="This can’t be undone."
                />
              </li>
            ))}
          </ul>
        )}
        <form action={addModifier.bind(null, item.id)} className="mt-3 flex items-end gap-3">
          <Field label="New modifier" className="flex-1">
            <input name="name" required maxLength={80} placeholder="e.g. Extra cheese" className={inputClass} />
          </Field>
          <Field label="Price">
            <input
              name="price"
              inputMode="decimal"
              pattern={DELTA_PATTERN}
              placeholder="1.00"
              className={priceInput}
            />
          </Field>
          <label className="flex items-center gap-1.5 pb-1.5 text-xs text-ink-2">
            <input type="checkbox" name="isRequired" className="h-3.5 w-3.5 accent-[var(--accent)]" />
            Required
          </label>
          <PrimaryButton>Add modifier</PrimaryButton>
        </form>
      </section>

      {/* Danger zone */}
      <section className="mt-12 max-w-[640px] border-t border-[var(--rule)] pt-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-ink-3">
            Deleting removes the item, its sizes, and modifiers. Items on past orders can’t be deleted — mark
            them unavailable instead.
          </p>
          <DeleteConfirm
            action={deleteItem.bind(null, item.id)}
            what="item"
            consequence="Removes it with all sizes and modifiers. This can’t be undone."
          />
        </div>
      </section>
    </div>
  );
}
