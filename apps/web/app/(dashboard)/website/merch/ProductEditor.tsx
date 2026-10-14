'use client';

import { useState } from 'react';
import type { MerchProductDto } from '@barrio/site-contract';
import { ActionForm, FieldError } from '@/components/website/ActionForm';
import { Field, inputClass, PrimaryButton } from '@/components/dashboard/form';
import { selectClass, textareaClass } from '@/components/website/ui';
import { saveProduct } from './actions';

type Row = { key: string; id: string; size: string; color: string; price: string; stock: string; sku: string };

const dollars = (c: number | null): string => (c == null ? '' : (c / 100).toFixed(2).replace(/\.00$/, ''));

/** Same rule as the website: what /merch/<slug> becomes when the link is left blank. */
function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

const blankRow = (key: string): Row => ({ key, id: '', size: '', color: '', price: '', stock: '', sku: '' });

const COLUMNS = [
  ['v_size', 'size', 'Size', 'M'],
  ['v_color', 'color', 'Color', 'Black'],
  ['v_price', 'price', 'Price ($)', 'product'],
  ['v_stock', 'stock', 'Stock', '∞'],
  ['v_sku', 'sku', 'SKU', ''],
] as const;

/**
 * Create / edit a product: details, photo and the full variant list. The
 * website saves it all at once (variants removed here are deleted there).
 */
export function ProductEditor({ product, photoSrc }: { product: MerchProductDto | null; photoSrc: string | null }): React.JSX.Element {
  const [name, setName] = useState(product?.name ?? '');
  const [rows, setRows] = useState<Row[]>(() =>
    product?.variants.length
      ? product.variants.map((v) => ({
          key: v.id,
          id: v.id,
          size: v.size ?? '',
          color: v.color ?? '',
          price: dollars(v.priceCents),
          stock: v.stock == null ? '' : String(v.stock),
          sku: v.sku ?? '',
        }))
      : [blankRow('n0')],
  );
  const update = (key: string, field: keyof Row, value: string) =>
    setRows((r) => r.map((x) => (x.key === key ? { ...x, [field]: value } : x)));

  return (
    <ActionForm action={saveProduct} className="grid gap-6">
      <input type="hidden" name="id" value={product?.id ?? ''} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input name="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          <FieldError name="name" />
        </Field>
        <Field label="Link" hint={`Blank = made from the name: /merch/${slugify(product?.slug || name) || '…'}`}>
          <input name="slug" maxLength={60} defaultValue={product?.slug ?? ''} placeholder={slugify(name)} className={inputClass} />
          <FieldError name="slug" />
        </Field>
        <Field label="Price ($)" hint="Variants can override it (e.g. 2XL).">
          <input
            name="price"
            required
            inputMode="decimal"
            pattern="\$?\d{1,5}(\.\d{1,2})?"
            placeholder="28"
            defaultValue={dollars(product?.priceCents ?? null)}
            className={`${inputClass} font-mono tabular-nums`}
          />
          <FieldError name="price" />
        </Field>
        <Field label="Sort order" hint="Lower shows first on /merch.">
          <input name="sortOrder" type="number" min={0} max={999} defaultValue={product?.sortOrder ?? 0} className={`${inputClass} w-24`} />
          <FieldError name="sortOrder" />
        </Field>
        <Field label="Who ships it">
          <select name="fulfillment" defaultValue={product?.fulfillment ?? 'self'} className={selectClass}>
            <option value="self">We ship / hand over at the truck</option>
            <option value="pod">Print on demand (provider not set up yet)</option>
          </select>
        </Field>
        <Field label="Provider product id" hint="Only for print on demand.">
          <input name="providerRef" maxLength={120} defaultValue={product?.providerRef ?? ''} className={inputClass} />
          <FieldError name="providerRef" />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <textarea name="description" maxLength={1000} defaultValue={product?.description ?? ''} className={textareaClass} />
          <FieldError name="description" />
        </Field>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        {photoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote site image
          <img src={photoSrc} alt="Current product photo" className="size-28 rounded-[var(--radius)] border border-[var(--rule)] object-cover" />
        ) : null}
        <Field label={photoSrc ? 'Replace photo' : 'Photo'} hint="JPG, PNG or WebP, up to 8 MB. Square works best.">
          <input
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="max-w-full text-sm text-ink-2 file:mr-3 file:cursor-pointer file:rounded-[var(--radius)] file:border file:border-[var(--rule)] file:bg-bg-raised file:px-3 file:py-1 file:text-sm file:text-ink"
          />
          <FieldError name="photo" />
        </Field>
      </div>

      <fieldset className="grid gap-2">
        <legend className="font-display text-lg text-ink">Variants</legend>
        <p className="text-xs text-ink-3">
          One row per size/color. Leave size and color blank for a single-option product. Price blank = product price; stock blank =
          unlimited.
        </p>
        <FieldError name="variants" />
        <div className="grid gap-2">
          {rows.map((r, i) => (
            <div
              key={r.key}
              className="grid grid-cols-2 items-end gap-x-3 gap-y-2 rounded-[var(--radius)] border border-[var(--rule)] p-3 sm:grid-cols-[1fr_1fr_6rem_5rem_1fr_auto]"
            >
              <input type="hidden" name="v_id" value={r.id} />
              {COLUMNS.map(([inputName, field, label, ph]) => (
                <label key={inputName} className="flex min-w-0 flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-ink-3">
                    {label}
                    <span className="sr-only"> for variant {i + 1}</span>
                  </span>
                  <input
                    name={inputName}
                    value={r[field]}
                    placeholder={ph}
                    inputMode={field === 'price' ? 'decimal' : field === 'stock' ? 'numeric' : undefined}
                    onChange={(e) => update(r.key, field, e.target.value)}
                    className={`${inputClass} ${field === 'price' || field === 'stock' ? 'font-mono tabular-nums' : ''}`}
                  />
                </label>
              ))}
              <button
                type="button"
                disabled={rows.length === 1}
                onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))}
                aria-label={`Remove variant ${i + 1}`}
                className="justify-self-start rounded-[var(--radius)] px-2 py-1 text-sm text-ink-3 hover:bg-bg-sunken hover:text-danger disabled:opacity-40 sm:justify-self-end"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRows((x) => [...x, blankRow(`n${Date.now()}`)])}
          className="justify-self-start rounded-[var(--radius)] border border-dashed border-[var(--rule)] px-3 py-1.5 text-sm text-ink-2 hover:bg-bg-sunken hover:text-ink"
        >
          + Add variant
        </button>
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="active" defaultChecked={product?.active ?? true} className="size-4 accent-[var(--accent)]" />
        Live on the website
      </label>

      <div>
        <PrimaryButton>{product ? 'Save product' : 'Create product'}</PrimaryButton>
      </div>
    </ActionForm>
  );
}
