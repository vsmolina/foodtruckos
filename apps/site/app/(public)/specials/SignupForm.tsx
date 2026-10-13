'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox, FormNotice, Honeypot, TextField } from '@/components/ui/Field';
import { signUp, type SignupState } from './actions';

// Each channel has its own unchecked consent box sitting right under its field.
export function SignupForm({ emailConsent, smsConsent }: { emailConsent: string; smsConsent: string }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(signUp, { status: 'idle' });

  if (state.status === 'success') {
    return (
      <div className="paper tilt-c pop-in flex flex-col gap-2 p-6" role="status">
        <p className="font-hand text-2xl text-[#b3261e]">¡Ya estás!</p>
        <h2 className="font-display text-h3 uppercase">You’re on the list</h2>
        <p className="text-lg">
          {state.sms && state.email
            ? 'Check your texts and inbox for a welcome message.'
            : state.sms
              ? 'Check your texts for a welcome message.'
              : 'Check your inbox for a welcome email.'}
        </p>
      </div>
    );
  }

  const err = state.status === 'error' ? state.fieldErrors : {};
  const v = state.status === 'error' ? state.values : { email: '', phone: '' };
  // Body text of the consent labels: link "Terms & Privacy" at the end.
  const smsMain = smsConsent.replace(/ See Terms & Privacy\.$/, '');

  return (
    <form key={state.status === 'error' ? state.attempt : 0} action={action} noValidate className="panel relative flex flex-col gap-5 p-5 sm:p-6">
      {state.status === 'error' ? <FormNotice tone="error">{state.message}</FormNotice> : null}
      <Honeypot />
      <div className="flex flex-col gap-3">
        <TextField name="email" type="email" label="Email" autoComplete="email" defaultValue={v.email} error={err.email} />
        <Checkbox name="emailConsent" label={emailConsent} error={err.emailConsent} />
      </div>
      <div className="flex flex-col gap-3 border-t-2 border-dashed border-surface-2 pt-5">
        <TextField name="phone" type="tel" inputMode="tel" label="Mobile number" autoComplete="tel" defaultValue={v.phone} error={err.phone} />
        <Checkbox
          name="smsConsent"
          error={err.smsConsent}
          label={
            <>
              {smsMain} See{' '}
              <Link href="/terms#sms" className="font-bold underline">
                Terms
              </Link>{' '}
              &amp;{' '}
              <Link href="/privacy" className="font-bold underline">
                Privacy
              </Link>
              .
            </>
          }
        />
      </div>
      <Button type="submit" size="lg" loading={pending}>
        Sign me up
      </Button>
      <p className="text-sm text-ink-muted">Pick one or both. We never sell your info.</p>
    </form>
  );
}
