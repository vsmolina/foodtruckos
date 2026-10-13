'use client';

import Link from 'next/link';
import { startTransition, useActionState, useState } from 'react';
import { imageSize, resizeImage } from '@/components/gallery/resize-image';
import { Button, LinkButton } from '@/components/ui/Button';
import { Checkbox, FieldError, FormNotice, Honeypot, TextArea, TextField } from '@/components/ui/Field';
import { SUBMIT_CONSENT } from '@/lib/gallery/consent';
import { submitPhoto, type SubmitState } from './actions';

export function SubmitForm() {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitPhoto, {});
  const [preview, setPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  if (state.ok) {
    return (
      <div className="paper tilt-b rise-in flex flex-col gap-3 p-6" role="status">
        <p className="font-hand text-xl text-[#1f7a45]">¡Gracias!</p>
        <h2 className="font-display text-h3 uppercase">Thanks — we’ll review it.</h2>
        <p className="text-lg">If it makes the wall, it’ll show up in the gallery. We’ll reach out by email if we have a question.</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <LinkButton href="/gallery" variant="primary">
            Back to the gallery
          </LinkButton>
        </div>
      </div>
    );
  }

  const v = state.values ?? {};
  const f = state.fields ?? {};

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const file = form.get('photo');
        if (file instanceof File && file.size > 0) {
          setPreparing(true);
          const small = await resizeImage(file);
          const size = await imageSize(small);
          form.set('photo', small);
          if (size) {
            form.set('width', String(size.width));
            form.set('height', String(size.height));
          }
          setPreparing(false);
        }
        startTransition(() => action(form));
      }}
    >
      {state.error ? <FormNotice tone="error">{state.error}</FormNotice> : null}
      <Honeypot />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="photo" className="text-sm font-bold">
          Your photo<span aria-hidden className="text-danger"> *</span>
        </label>
        <p id="photo-hint" className="text-sm text-ink-muted">
          JPG, PNG or WebP. We shrink big photos before sending.
        </p>
        <label
          htmlFor="photo"
          className="press shadow-hard-sm relative flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-sm border-[length:var(--line-thin)] border-dashed border-outline bg-surface-2 p-4 text-center"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Selected photo preview" className="max-h-64 w-auto border-2 border-outline object-contain" />
          ) : (
            <>
              <span className="font-display text-lg uppercase">Tap to choose a photo</span>
              <span className="font-hand text-marigold">o toma una foto</span>
            </>
          )}
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            required
            aria-invalid={f.photo ? true : undefined}
            aria-describedby={f.photo ? 'photo-hint photo-error' : 'photo-hint'}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview((old) => {
                if (old) URL.revokeObjectURL(old);
                return file ? URL.createObjectURL(file) : null;
              });
            }}
          />
        </label>
        <FieldError name="photo" error={f.photo} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="name" label="Your name" autoComplete="name" required defaultValue={v.name} error={f.name} />
        <TextField
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={v.email}
          error={f.email}
          hint="Only for questions about your photo. Never shown."
        />
      </div>
      <TextField name="instagram" label="Instagram handle (optional)" placeholder="@yourhandle" autoCapitalize="none" defaultValue={v.instagram} error={f.instagram} hint="We’ll credit you." />
      <TextArea name="caption" label="Caption (optional)" rows={2} maxLength={140} defaultValue={v.caption} error={f.caption} />

      <fieldset className="flex flex-col gap-3 rounded-sm border-[length:var(--line-thin)] border-outline p-4">
        <legend className="px-1 text-sm font-bold">Before we can post it</legend>
        <Checkbox name="consent_rights" label={SUBMIT_CONSENT.rights} error={f.consent_rights} />
        <Checkbox name="consent_people" label={SUBMIT_CONSENT.people} error={f.consent_people} />
        <Checkbox
          name="consent_terms"
          label={
            <>
              I agree to the{' '}
              <Link href="/terms#photos" className="font-bold underline">
                photo terms
              </Link>
              .
            </>
          }
          error={f.consent_terms}
        />
        <p className="text-sm text-ink-muted">You can ask us to take any photo down at any time.</p>
      </fieldset>

      <Button type="submit" size="lg" loading={pending || preparing} className="self-start">
        {preparing ? 'Preparing photo…' : pending ? 'Sending…' : 'Send it in'}
      </Button>
    </form>
  );
}
