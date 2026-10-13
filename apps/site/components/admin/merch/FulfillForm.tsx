'use client';

import { useActionState } from 'react';
import { markFulfilled, type FormState } from '@/app/admin/(panel)/merch/actions';
import { Button } from '@/components/ui/Button';
import { Checkbox, FormNotice, TextField } from '@/components/ui/Field';

export function FulfillForm({
  id,
  delivery,
  tracking,
  hasEmail,
  done,
}: {
  id: string;
  delivery: string;
  tracking: string;
  hasEmail: boolean;
  done: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(markFulfilled, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      {state.error ? <FormNotice tone="error">{state.error}</FormNotice> : null}
      {state.ok ? <FormNotice tone="success">{state.ok}</FormNotice> : null}
      {delivery === 'ship' ? (
        <TextField name="tracking" label="Tracking number" defaultValue={tracking} maxLength={80} />
      ) : null}
      {hasEmail ? (
        <Checkbox
          name="notify"
          value="on"
          defaultChecked
          label={
            delivery === 'ship'
              ? 'Email the customer that it shipped'
              : 'Email the customer that it’s ready at the truck'
          }
        />
      ) : null}
      <Button type="submit" variant="agave" loading={pending} className="self-start">
        {done ? 'Update' : delivery === 'ship' ? 'Mark shipped' : 'Mark picked up / ready'}
      </Button>
    </form>
  );
}
