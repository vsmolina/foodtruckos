'use client';

import type { SpecialDto } from '@barrio/site-contract';
import { ActionForm, FieldError } from '@/components/website/ActionForm';
import { Field, inputClass, PrimaryButton } from '@/components/dashboard/form';
import { textareaClass } from '@/components/website/ui';
import { saveSpecial, setSpecialActive } from './actions';

export function SpecialForm({ special }: { special: SpecialDto | null }): React.JSX.Element {
  const s = special;
  return (
    <ActionForm action={saveSpecial.bind(null, s?.id ?? null)} className="grid gap-5 sm:grid-cols-2">
      <Field label="Title" className="sm:col-span-2">
        <input name="title" required maxLength={80} defaultValue={s?.title ?? ''} className={inputClass} />
        <FieldError name="title" />
      </Field>
      <Field label="Sticker (Spanish, optional)" hint="e.g. ¡Nuevo! · ¡Jueves!">
        <input name="kicker" maxLength={24} defaultValue={s?.kicker ?? ''} className={inputClass} />
        <FieldError name="kicker" />
      </Field>
      <Field label="Price label (optional)" hint="e.g. $13 or 2 × $10">
        <input name="priceLabel" maxLength={12} defaultValue={s?.priceLabel ?? ''} className={inputClass} />
        <FieldError name="priceLabel" />
      </Field>
      <Field label="Details" className="sm:col-span-2">
        <textarea name="body" maxLength={400} rows={3} defaultValue={s?.body ?? ''} className={textareaClass} />
        <FieldError name="body" />
      </Field>
      <Field label="Starts (optional)" hint="San Marcos time. Blank = right away.">
        <input name="startsAt" type="datetime-local" defaultValue={s?.startsAtLocal ?? ''} className={inputClass} />
        <FieldError name="startsAt" />
      </Field>
      <Field label="Ends (optional)" hint="Blank = until you turn it off.">
        <input name="endsAt" type="datetime-local" defaultValue={s?.endsAtLocal ?? ''} className={inputClass} />
        <FieldError name="endsAt" />
      </Field>
      <Field label="Photo (optional)" hint="JPG, PNG or WebP, up to 8 MB." className="sm:col-span-2">
        <input
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-sm text-ink-2 file:mr-3 file:rounded-[var(--radius)] file:border file:border-[var(--rule)] file:bg-transparent file:px-2 file:py-1 file:text-sm file:text-ink-2"
        />
        <FieldError name="photo" />
      </Field>
      {s?.photoUrl ? (
        <label className="flex items-center gap-2 text-sm text-ink-2 sm:col-span-2">
          <input type="checkbox" name="removePhoto" className="size-4 accent-[var(--accent)]" />
          Remove the current photo
        </label>
      ) : null}
      <Field label="Order" hint="Lower shows first." className="w-36">
        <input name="sortOrder" type="number" min={0} max={999} defaultValue={s?.sortOrder ?? 0} className={inputClass} />
        <FieldError name="sortOrder" />
      </Field>
      <label className="flex items-center gap-2 self-end pb-1 text-sm text-ink">
        <input type="checkbox" name="active" defaultChecked={s?.active ?? true} className="size-4 accent-[var(--accent)]" />
        Show on the website
      </label>
      <div className="sm:col-span-2">
        <PrimaryButton>{s ? 'Save special' : 'Create special'}</PrimaryButton>
      </div>
    </ActionForm>
  );
}

export function ActiveToggle({ id, active }: { id: string; active: boolean }): React.JSX.Element {
  return (
    <ActionForm action={setSpecialActive.bind(null, id, !active)}>
      <button
        type="submit"
        aria-pressed={active}
        className="min-h-9 whitespace-nowrap rounded-[var(--radius)] border border-[var(--rule)] px-3 text-sm text-ink-2 hover:bg-bg-sunken hover:text-ink"
      >
        {active ? 'Turn off' : 'Turn on'}
      </button>
    </ActionForm>
  );
}
