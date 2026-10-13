'use client';

import { ActionForm, FieldError } from '@/components/website/ActionForm';
import { inputClass, QuietButton } from '@/components/dashboard/form';
import { setStock } from './actions';

/** Quick stock edit for one variant: blank = unlimited. */
export function StockForm({ variantId, label, stock }: { variantId: string; label: string; stock: number | null }): React.JSX.Element {
  return (
    <ActionForm action={setStock.bind(null, variantId)} className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-sm">
        <span className="min-w-24 text-ink-2">{label || 'Stock'}</span>
        <input
          name="stock"
          type="number"
          min={0}
          max={99999}
          step={1}
          inputMode="numeric"
          placeholder="∞"
          defaultValue={stock ?? ''}
          aria-label={`Stock for ${label || 'this product'}`}
          className={`${inputClass} w-20 font-mono tabular-nums`}
        />
      </label>
      <QuietButton>Set</QuietButton>
      <FieldError name="stock" />
    </ActionForm>
  );
}
