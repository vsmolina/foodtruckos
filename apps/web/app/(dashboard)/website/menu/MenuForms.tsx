'use client';

import { useEffect } from 'react';
import type { MenuItemFlag } from '@barrio/site-contract';
import { ActionForm, FieldError } from '@/components/website/ActionForm';
import { Field, inputClass, PrimaryButton } from '@/components/dashboard/form';
import { saveCategory, saveItem, setCategoryHidden, setItemFlag, syncFromSquare } from './actions';

export function SyncButton({ disabled }: { disabled: boolean }): React.JSX.Element {
  return (
    <ActionForm action={syncFromSquare}>
      <button
        type="submit"
        disabled={disabled}
        className="rounded-[var(--radius)] bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Sync from Square
      </button>
    </ActionForm>
  );
}

/** On/off switch for one website-only flag. Shows the current state in words. */
export function FlagToggle({
  id,
  flag,
  on,
  onLabel,
  offLabel,
  onTone,
}: {
  id: string;
  flag: MenuItemFlag;
  on: boolean;
  onLabel: string;
  offLabel: string;
  onTone: 'danger' | 'neutral' | 'accent';
}): React.JSX.Element {
  const tone = {
    danger: 'border-[var(--danger)] bg-[var(--danger)] text-white',
    neutral: 'border-[var(--ink-3)] bg-bg-sunken text-ink',
    accent: 'border-[var(--accent)] bg-accent text-accent-ink',
  }[onTone];
  return (
    <ActionForm action={setItemFlag.bind(null, id, flag, !on)}>
      <button
        type="submit"
        aria-pressed={on}
        title={on ? `Click to switch to “${offLabel}”` : `Click to switch to “${onLabel}”`}
        className={`min-h-9 min-w-24 whitespace-nowrap rounded-[var(--radius)] border px-2.5 text-sm font-medium ${
          on ? tone : 'border-[var(--rule)] text-ink-2 hover:bg-bg-sunken hover:text-ink'
        }`}
      >
        {on ? onLabel : offLabel}
      </button>
    </ActionForm>
  );
}

export function CategoryForm({ id, labelEs, sortOrder }: { id: string; labelEs: string; sortOrder: number }): React.JSX.Element {
  return (
    <ActionForm action={saveCategory.bind(null, id)} className="flex flex-wrap items-end gap-4">
      <Field label="Spanish label" className="w-44">
        <input name="labelEs" defaultValue={labelEs} maxLength={40} placeholder="e.g. Hamburguesas" className={inputClass} />
        <FieldError name="labelEs" />
      </Field>
      <Field label="Order" className="w-16">
        <input name="sortOrder" type="number" min={0} max={999} defaultValue={sortOrder} className={inputClass} />
        <FieldError name="sortOrder" />
      </Field>
      <button
        type="submit"
        className="rounded-[var(--radius)] border border-[var(--rule)] px-3 py-1.5 text-sm text-ink-2 hover:bg-bg-sunken hover:text-ink"
      >
        Save
      </button>
    </ActionForm>
  );
}

export function CategoryHiddenToggle({ id, hidden }: { id: string; hidden: boolean }): React.JSX.Element {
  return (
    <ActionForm action={setCategoryHidden.bind(null, id, !hidden)}>
      <button
        type="submit"
        aria-pressed={hidden}
        className="whitespace-nowrap rounded-[var(--radius)] border border-[var(--rule)] px-3 py-1.5 text-sm text-ink-2 hover:bg-bg-sunken hover:text-ink"
      >
        {hidden ? 'Show category' : 'Hide category'}
      </button>
    </ActionForm>
  );
}

export function ItemForm({
  id,
  taglineEs,
  sortOrder,
  hasOverride,
}: {
  id: string;
  taglineEs: string;
  sortOrder: number;
  hasOverride: boolean;
}): React.JSX.Element {
  return (
    <ActionForm action={saveItem.bind(null, id)} className="grid gap-4 sm:grid-cols-[1fr_5rem]">
      <Field label="Spanish tagline" hint="Hand-lettered under the name, e.g. “¡La mera buena!”. Blank for none.">
        <input name="taglineEs" defaultValue={taglineEs} maxLength={60} className={inputClass} />
        <FieldError name="taglineEs" />
      </Field>
      <Field label="Order">
        <input name="sortOrder" type="number" min={0} max={999} defaultValue={sortOrder} className={inputClass} />
        <FieldError name="sortOrder" />
      </Field>
      <Field label="Website photo" hint="Replaces the Square photo on the website. JPG, PNG or WebP, up to 8 MB." className="sm:col-span-2">
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm text-ink-2 file:mr-3 file:rounded-[var(--radius)] file:border file:border-[var(--rule)] file:bg-transparent file:px-2 file:py-1 file:text-sm file:text-ink-2" />
        <FieldError name="photo" />
      </Field>
      {hasOverride ? (
        <label className="flex items-center gap-2 text-sm text-ink-2 sm:col-span-2">
          <input type="checkbox" name="removePhoto" className="size-4 accent-[var(--accent)]" />
          Remove the website photo (use the Square photo again)
        </label>
      ) : null}
      <div className="sm:col-span-2">
        <PrimaryButton>Save</PrimaryButton>
      </div>
    </ActionForm>
  );
}

/** Opens the matching <details> when the URL hash points at it (link from the Menu item page). */
export function OpenOnHash(): null {
  useEffect(() => {
    const open = (): void => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!hash) return;
      const row = document.getElementById(hash);
      row?.querySelector('details')?.setAttribute('open', '');
      row?.scrollIntoView({ block: 'center' });
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);
  return null;
}
