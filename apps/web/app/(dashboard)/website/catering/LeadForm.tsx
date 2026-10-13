'use client';

import type { CateringStage } from '@barrio/site-contract';
import { ActionForm, FieldError } from '@/components/website/ActionForm';
import { Field, PrimaryButton } from '@/components/dashboard/form';
import { textareaClass } from '@/components/website/ui';
import { updateLead } from './actions';
import { STAGE_LABEL, STAGES } from './shared';

export function LeadForm({ id, status, adminNotes }: { id: string; status: CateringStage; adminNotes: string | null }): React.JSX.Element {
  return (
    <ActionForm action={updateLead.bind(null, id)} className="grid gap-4">
      <fieldset>
        <legend className="mb-2 text-xs uppercase tracking-wide text-ink-3">Stage</legend>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <label
              key={s}
              className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-[var(--rule)] px-3 text-sm text-ink-2 has-[:checked]:border-[var(--accent)] has-[:checked]:font-medium has-[:checked]:text-ink"
            >
              <input type="radio" name="status" value={s} defaultChecked={status === s} className="size-4 accent-[var(--accent)]" />
              {STAGE_LABEL[s]}
            </label>
          ))}
        </div>
        <FieldError name="status" />
      </fieldset>
      <Field label="Private notes" hint="Only you see these.">
        <textarea name="adminNotes" rows={5} maxLength={5000} defaultValue={adminNotes ?? ''} className={textareaClass} />
        <FieldError name="adminNotes" />
      </Field>
      <div>
        <PrimaryButton>Save</PrimaryButton>
      </div>
    </ActionForm>
  );
}
