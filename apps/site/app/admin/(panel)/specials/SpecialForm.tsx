'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox, FormNotice, TextArea, TextField } from '@/components/ui/Field';
import { saveSpecial, type SpecialState } from './actions';

export type SpecialDefaults = {
  title: string;
  kicker: string;
  body: string;
  priceLabel: string;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  active: boolean;
};

export function SpecialForm({ id, defaults }: { id: string | null; defaults: SpecialDefaults }) {
  const [state, action, pending] = useActionState<SpecialState, FormData>(saveSpecial.bind(null, id), {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {state.error ? (
        <div className="sm:col-span-2">
          <FormNotice tone="error">{state.error}</FormNotice>
        </div>
      ) : null}
      <TextField name="title" label="Title" required defaultValue={defaults.title} maxLength={80} error={fe.title} className="sm:col-span-2" />
      <TextField name="kicker" label="Sticker (Spanish, optional)" hint="e.g. ¡Nuevo! · ¡Jueves!" defaultValue={defaults.kicker} maxLength={24} error={fe.kicker} />
      <TextField name="priceLabel" label="Price label (optional)" hint="e.g. $13 or 2 × $10" defaultValue={defaults.priceLabel} maxLength={12} error={fe.priceLabel} />
      <TextArea name="body" label="Details" defaultValue={defaults.body} maxLength={400} rows={3} error={fe.body} className="sm:col-span-2" />
      <TextField name="startsAt" type="datetime-local" label="Starts (optional)" hint="San Marcos time" defaultValue={defaults.startsAt} error={fe.startsAt} />
      <TextField name="endsAt" type="datetime-local" label="Ends (optional)" defaultValue={defaults.endsAt} error={fe.endsAt} />
      <TextField name="photo" type="file" accept="image/jpeg,image/png,image/webp" label="Photo (optional)" className="sm:col-span-2" />
      <TextField name="sortOrder" type="number" min={0} label="Order" defaultValue={defaults.sortOrder} className="max-w-40" />
      <Checkbox name="active" value="on" label="Show on the website" defaultChecked={defaults.active} />
      <Button type="submit" variant="marigold" loading={pending} className="self-start sm:col-span-2 sm:justify-self-start">
        Save special
      </Button>
    </form>
  );
}
