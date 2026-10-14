'use client';

import { useActionState, useState } from 'react';
import { saveProduct, type FormState } from '@/app/admin/(panel)/merch/actions';
import { Button } from '@/components/ui/Button';
import { Checkbox, FormNotice, SelectField, TextArea, TextField } from '@/components/ui/Field';

type V = {
  id: string;
  size: string;
  color: string;
  price: string;
  stock: string;
  sku: string;
  key: string;
};

export type ProductInput = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  fulfillment: string;
  providerRef: string;
  sortOrder: number;
  active: boolean;
  photoUrl: string | null;
  variants: Omit<V, 'key'>[];
};

const CELL =
  'min-h-11 w-full rounded-sm border-2 border-outline bg-paper px-2 text-paper-ink focus:outline-none focus-visible:outline-[3px] focus-visible:outline-[var(--focus)]';

export function ProductForm({ product }: { product: ProductInput }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProduct, {});
  const [rows, setRows] = useState<V[]>(() =>
    (product.variants.length
      ? product.variants
      : [{ id: '', size: '', color: '', price: '', stock: '', sku: '' }]
    ).map((v, i) => ({ ...v, key: `${i}-${v.id}` })),
  );
  const update = (key: string, field: keyof V, value: string) =>
    setRows((r) => r.map((x) => (x.key === key ? { ...x, [field]: value } : x)));

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={product.id} />
      {state.error ? <FormNotice tone="error">{state.error}</FormNotice> : null}
      {state.ok ? <FormNotice tone="success">{state.ok}</FormNotice> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label="Name" defaultValue={product.name} required maxLength={80} />
        <TextField
          name="slug"
          label="Link"
          hint="Blank = made from the name. /merch/…"
          defaultValue={product.slug}
          maxLength={60}
        />
        <TextField
          name="price"
          label="Price ($)"
          inputMode="decimal"
          defaultValue={product.price}
          required
          placeholder="28"
        />
        <TextField
          name="sortOrder"
          label="Sort order"
          type="number"
          min={0}
          max={999}
          defaultValue={product.sortOrder}
        />
        <SelectField
          name="fulfillment"
          label="Who ships it"
          defaultValue={product.fulfillment}
          options={[
            { value: 'self', label: 'We ship / hand over at the truck' },
            { value: 'pod', label: 'Print on demand (provider not set up yet)' },
          ]}
        />
        <TextField
          name="providerRef"
          label="Provider product id"
          hint="Only for print on demand."
          defaultValue={product.providerRef}
          maxLength={120}
        />
      </div>
      <TextArea
        name="description"
        label="Description"
        defaultValue={product.description}
        maxLength={1000}
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="photo" className="text-sm font-bold">
          Photo {product.photoUrl ? '(uploading replaces the current one)' : ''}
        </label>
        {product.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.photoUrl}
            alt=""
            className="h-28 w-28 rounded-sm border-2 border-outline object-cover"
          />
        ) : null}
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="min-h-11 text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-sm file:border-2 file:border-outline file:bg-paper file:px-3 file:font-bold file:text-paper-ink"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-lg font-bold">Variants</legend>
        <p className="text-sm text-ink-muted">
          Price blank = product price. Stock blank = unlimited.
        </p>
        <div className="flex flex-col gap-3">
          {rows.map((r, i) => (
            <div
              key={r.key}
              className="grid grid-cols-2 gap-2 rounded-md border-2 border-surface-2 p-2 sm:grid-cols-[1fr_1fr_0.8fr_0.7fr_1fr_auto] sm:items-end"
            >
              <input type="hidden" name="v_id" value={r.id} />
              {(
                [
                  ['v_size', 'size', 'Size', 'M'],
                  ['v_color', 'color', 'Color', 'Black'],
                  ['v_price', 'price', 'Price', ''],
                  ['v_stock', 'stock', 'Stock', '∞'],
                  ['v_sku', 'sku', 'SKU', ''],
                ] as const
              ).map(([name, field, label, ph]) => (
                <label key={name} className="flex flex-col gap-1 text-xs font-bold">
                  {label} <span className="sr-only">for variant {i + 1}</span>
                  <input
                    name={name}
                    value={r[field]}
                    placeholder={ph}
                    inputMode={
                      field === 'price' ? 'decimal' : field === 'stock' ? 'numeric' : undefined
                    }
                    onChange={(e) => update(r.key, field, e.target.value)}
                    className={CELL}
                  />
                </label>
              ))}
              <button
                type="button"
                onClick={() =>
                  setRows((x) => (x.length > 1 ? x.filter((y) => y.key !== r.key) : x))
                }
                className="min-h-11 rounded-sm border-2 border-outline px-3 text-sm font-bold"
                aria-label={`Remove variant ${i + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setRows((x) => [
              ...x,
              { id: '', size: '', color: '', price: '', stock: '', sku: '', key: `n${Date.now()}` },
            ])
          }
          className="min-h-11 self-start rounded-sm border-2 border-dashed border-outline px-4 font-bold"
        >
          + Add variant
        </button>
      </fieldset>

      <Checkbox name="active" value="on" label="Live on the site" defaultChecked={product.active} />
      <Button type="submit" loading={pending} className="self-start">
        Save product
      </Button>
    </form>
  );
}
