import type { PartnerDto } from '@barrio/site-contract';
import { ActionForm, FieldError } from '@/components/website/ActionForm';
import { Field, inputClass, PrimaryButton } from '@/components/dashboard/form';
import { selectClass, textareaClass } from '@/components/website/ui';
import { savePartner } from './actions';

// Create / edit a partner. Server component: ActionForm (client) handles the
// result banner and field errors from the website.
export function PartnerForm({ partner }: { partner?: PartnerDto }): React.JSX.Element {
  return (
    <ActionForm action={savePartner.bind(null, partner?.id ?? null)} encType="multipart/form-data" className="grid gap-4 sm:grid-cols-2">
      <Field label="Name">
        <input name="name" required maxLength={80} defaultValue={partner?.name} className={inputClass} />
        <FieldError name="name" />
      </Field>
      <Field label="Type">
        <select name="kind" defaultValue={partner?.kind ?? 'bar'} className={selectClass}>
          <option value="bar">Bar</option>
          <option value="bartender">Bartender</option>
          <option value="other">Other</option>
        </select>
        <FieldError name="kind" />
      </Field>
      <Field label="Referral code" hint="3–16 letters or numbers. Their link is /r/CODE. Changing it breaks printed QR cards.">
        <input
          name="code"
          required
          maxLength={16}
          pattern="[A-Za-z0-9]{3,16}"
          defaultValue={partner?.code}
          autoCapitalize="characters"
          className={`${inputClass} font-mono uppercase`}
        />
        <FieldError name="code" />
      </Field>
      <Field label="Sort order" hint="Lower shows first on the Partners page.">
        <input name="sortOrder" type="number" min={0} max={999} defaultValue={partner?.sortOrder ?? 0} className={inputClass} />
        <FieldError name="sortOrder" />
      </Field>
      <Field label="Instagram (optional)">
        <input name="instagram" maxLength={60} placeholder="@handle" defaultValue={partner?.instagram ?? ''} autoCapitalize="none" className={inputClass} />
        <FieldError name="instagram" />
      </Field>
      <Field label="Website (optional)">
        <input name="url" type="url" maxLength={300} placeholder="https://" defaultValue={partner?.url ?? ''} className={inputClass} />
        <FieldError name="url" />
      </Field>
      <Field label="Blurb" hint="Shown on the website’s Partners page." className="sm:col-span-2">
        <textarea name="blurb" maxLength={280} rows={3} defaultValue={partner?.blurb ?? ''} className={textareaClass} />
        <FieldError name="blurb" />
      </Field>
      <Field label={partner?.photoUrl ? 'Replace photo' : 'Photo (optional)'} hint="JPG, PNG or WebP, up to 8 MB.">
        <input
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-sm text-ink-2 file:mr-3 file:rounded-[var(--radius)] file:border file:border-[var(--rule)] file:bg-bg-raised file:px-3 file:py-1.5 file:text-sm file:text-ink"
        />
        <FieldError name="photo" />
      </Field>
      <label className="flex items-start gap-2 self-end text-sm text-ink-2">
        <input type="checkbox" name="active" defaultChecked={partner ? partner.active : true} className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
        <span>Active — listed on the Partners page and the link works. Untick to deactivate.</span>
      </label>
      <div className="sm:col-span-2">
        <PrimaryButton>{partner ? 'Save partner' : 'Add partner'}</PrimaryButton>
      </div>
    </ActionForm>
  );
}
