'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormNotice, TextField } from '@/components/ui/Field';
import { signIn, type LoginState } from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error ? <FormNotice tone="error">{state.error}</FormNotice> : null}
      <TextField name="password" type="password" label="Password" autoComplete="current-password" required autoFocus />
      <Button type="submit" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}
