'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox, FormNotice, TextField } from '@/components/ui/Field';
import { saveItem, type MenuActionState } from '../actions';

export function ItemForm({ id, taglineEs, sortOrder, hasOverride }: { id: string; taglineEs: string; sortOrder: number; hasOverride: boolean }) {
  const [state, action, pending] = useActionState<MenuActionState, FormData>(saveItem.bind(null, id), {});
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error ? <FormNotice tone="error">{state.error}</FormNotice> : null}
      <TextField name="taglineEs" label="Spanish tagline (optional)" hint="Hand-lettered under the name, e.g. “¡La mera buena!”" defaultValue={taglineEs} maxLength={60} />
      <TextField name="sortOrder" type="number" min={0} label="Order in category" defaultValue={sortOrder} className="max-w-40" />
      <TextField name="photo" type="file" accept="image/jpeg,image/png,image/webp" label="Website photo" hint="Replaces the Square photo on the website. JPG/PNG/WebP, up to 8 MB." />
      {hasOverride ? <Checkbox name="removePhoto" value="on" label="Remove the website photo (use the Square photo again)" /> : null}
      <Button type="submit" variant="marigold" loading={pending} className="self-start">
        Save
      </Button>
    </form>
  );
}
