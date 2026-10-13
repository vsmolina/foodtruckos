'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox, FieldError, FormNotice, SelectField, TextArea, TextField } from '@/components/ui/Field';
import type { partners } from '@/lib/db/schema';
import { savePartner, type PartnerFormState } from './actions';

type Partner = typeof partners.$inferSelect;

export function PartnerForm({ partner }: { partner?: Partner }) {
  const [state, action, pending] = useActionState<PartnerFormState, FormData>(savePartner, {});
  const f = state.fields ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error ? <FormNotice tone="error">{state.error}</FormNotice> : null}
      {partner ? <input type="hidden" name="id" value={partner.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label="Name" required defaultValue={partner?.name} error={f.name} />
        <SelectField
          name="kind"
          label="Type"
          defaultValue={partner?.kind ?? 'bar'}
          options={[
            { value: 'bar', label: 'Bar' },
            { value: 'bartender', label: 'Bartender' },
            { value: 'other', label: 'Other' },
          ]}
          error={f.kind}
        />
        <TextField
          name="code"
          label="Referral code"
          required
          defaultValue={partner?.code}
          error={f.code}
          hint="Letters/numbers, 3–16. Their link is /r/CODE. Changing it breaks printed QR codes."
          autoCapitalize="characters"
          style={{ textTransform: 'uppercase' }}
        />
        <TextField name="sortOrder" type="number" inputMode="numeric" label="Sort order" defaultValue={partner?.sortOrder ?? 0} min={0} max={999} error={f.sortOrder} />
        <TextField name="instagram" label="Instagram (optional)" defaultValue={partner?.instagram ?? ''} placeholder="@handle" autoCapitalize="none" error={f.instagram} />
        <TextField name="url" type="url" label="Website (optional)" defaultValue={partner?.url ?? ''} placeholder="https://" error={f.url} />
      </div>
      <TextArea name="blurb" label="Blurb" rows={3} maxLength={280} defaultValue={partner?.blurb ?? ''} error={f.blurb} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="photo" className="text-sm font-bold">
          Photo {partner?.photoUrl ? '(replace)' : '(optional)'}
        </label>
        <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="min-h-12 rounded-sm border-2 border-outline bg-paper p-2 text-paper-ink" />
        <FieldError name="photo" error={f.photo} />
      </div>
      <Checkbox name="active" label="Active (shown on the Partners page; link works)" defaultChecked={partner ? partner.active : true} />
      <Button type="submit" loading={pending} className="self-start">
        {partner ? 'Save partner' : 'Add partner'}
      </Button>
    </form>
  );
}
