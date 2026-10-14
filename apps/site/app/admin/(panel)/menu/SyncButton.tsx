'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormNotice } from '@/components/ui/Field';
import { syncFromSquare, type MenuActionState } from './actions';

export function SyncButton({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState<MenuActionState>(syncFromSquare, {});
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <Button type="submit" variant="marigold" loading={pending} disabled={disabled}>
        Sync from Square
      </Button>
      {state.ok ? <FormNotice tone="success">{state.ok}</FormNotice> : null}
      {state.error ? <FormNotice tone="error">{state.error}</FormNotice> : null}
    </form>
  );
}
