'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormNotice } from '@/components/ui/Field';
import { connectInstagram, refreshInstagram, type InstagramState } from './actions';

export function ConnectInstagram({ reconnect }: { reconnect: boolean }) {
  const [state, action, pending] = useActionState<InstagramState, FormData>(connectInstagram, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error ? <FormNotice tone="error">{state.error}</FormNotice> : null}
      {state.ok ? <FormNotice tone="success">{state.ok}</FormNotice> : null}
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        {reconnect ? 'New access token' : 'Instagram access token'}
        <input
          name="accessToken"
          type="password"
          autoComplete="off"
          spellCheck={false}
          required
          className="min-h-12 rounded-sm border-2 border-outline bg-paper px-3 font-mono text-paper-ink"
        />
      </label>
      <Button type="submit" size="sm" loading={pending} className="self-start">
        {reconnect ? 'Reconnect' : 'Connect Instagram'}
      </Button>
    </form>
  );
}

export function RefreshInstagram() {
  const [state, action, pending] = useActionState<InstagramState>(refreshInstagram, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" variant="paper" size="sm" loading={pending} className="self-start">
        Refresh now
      </Button>
      {state.error ? <FormNotice tone="error">{state.error}</FormNotice> : null}
      {state.ok ? <FormNotice tone="success">{state.ok}</FormNotice> : null}
    </form>
  );
}
