'use client';

import { useActionState } from 'react';
import { Button, LinkButton } from '@/components/ui/Button';
import { FormNotice, Honeypot, TextArea, TextField } from '@/components/ui/Field';
import { requestTakedown, type TakedownState } from './actions';

export function TakedownForm({ photoId, photoUrl }: { photoId: string | null; photoUrl: string | null }) {
  const [state, action, pending] = useActionState<TakedownState, FormData>(requestTakedown, {});
  if (state.ok) {
    return (
      <div className="paper rise-in flex flex-col gap-3 p-6" role="status">
        <h2 className="font-display text-h3 uppercase">Request received</h2>
        <p className="text-lg">We’ll review it and take the photo down as soon as we can — usually within a day. We emailed you a confirmation.</p>
        <LinkButton href="/gallery" variant="primary" className="self-start">
          Back to the gallery
        </LinkButton>
      </div>
    );
  }
  const v = state.values ?? {};
  const f = state.fields ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error ? <FormNotice tone="error">{state.error}</FormNotice> : null}
      <Honeypot />
      <input type="hidden" name="photoId" value={photoId ?? ''} />
      {photoUrl ? (
        <div className="flex items-center gap-3 rounded-sm border-[length:var(--line-thin)] border-outline bg-surface p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="The photo you want removed" className="h-20 w-20 border-2 border-outline object-cover" />
          <p className="text-sm font-bold">This photo</p>
        </div>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="name" label="Your name" autoComplete="name" required defaultValue={v.name} error={f.name} />
        <TextField name="email" type="email" label="Email" autoComplete="email" inputMode="email" required defaultValue={v.email} error={f.email} />
      </div>
      {photoUrl ? null : (
        <TextArea
          name="description"
          label="Which photo?"
          hint="Describe it (who’s in it, what’s happening, roughly where it is in the gallery)."
          rows={3}
          required
          defaultValue={v.description}
          error={f.description}
        />
      )}
      <TextArea name="reason" label="Anything else we should know? (optional)" rows={3} defaultValue={v.reason} error={f.reason} />
      <Button type="submit" size="lg" loading={pending} className="self-start">
        Request removal
      </Button>
    </form>
  );
}
