'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox, FieldError, FormNotice, Honeypot, SelectField, TextArea, TextField } from '@/components/ui/Field';
import { Underline } from '@/components/ui/Doodles';
import { BUDGETS, DURATIONS, EVENT_TYPES, MENU_INTERESTS, SERVICE_STYLES } from '@/lib/catering';
import { cx } from '@/lib/cx';
import { submitCatering, type CateringState } from './actions';

export function CateringForm({ minDate }: { minDate: string }) {
  const [state, action, pending] = useActionState<CateringState, FormData>(submitCatering, { status: 'idle' });
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === 'idle') return;
    const el = topRef.current;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Move focus so screen readers announce the result.
    el?.focus({ preventScroll: true });
  }, [state]);

  if (state.status === 'success') {
    return (
      <div ref={topRef} tabIndex={-1} className="paper tilt-c pop-in flex scroll-mt-6 flex-col gap-3 p-6 outline-none sm:p-8" role="status">
        <p className="font-hand text-2xl text-[#b3261e]">¡Gracias, {state.name.split(' ')[0]}!</p>
        <h2 className="font-display text-h2 uppercase">Request received</h2>
        <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5 text-lg">
          <li>We sent a copy to {state.email}.</li>
          <li>We’ll call or email within 2 business days to talk menu, timing and logistics.</li>
          <li>You’ll get a written quote. Nothing is booked until we both confirm.</li>
        </ol>
      </div>
    );
  }

  const err = state.status === 'error' ? state.fieldErrors : {};
  const v = state.status === 'error' ? state.values : {};
  const val = (k: string) => (typeof v[k] === 'string' ? (v[k] as string) : undefined);
  const interests = Array.isArray(v.menuInterests) ? v.menuInterests : [];

  return (
    <div ref={topRef} tabIndex={-1} className="scroll-mt-6 outline-none">
      <form
        key={state.status === 'error' ? state.attempt : 0}
        action={action}
        noValidate
        className="panel relative flex flex-col gap-6 p-5 sm:p-8"
        aria-describedby={state.status === 'error' ? 'catering-error' : undefined}
      >
        {state.status === 'error' && state.message ? (
          <div id="catering-error">
            <FormNotice tone="error">{state.message}</FormNotice>
          </div>
        ) : null}
        <Honeypot />

        <Fieldset legend="You" es="¿Quién eres?">
          <TextField name="name" label="Name" autoComplete="name" required defaultValue={val('name')} error={err.name} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="phone" type="tel" inputMode="tel" label="Phone" autoComplete="tel" required defaultValue={val('phone')} error={err.phone} />
            <TextField name="email" type="email" label="Email" autoComplete="email" required defaultValue={val('email')} error={err.email} />
          </div>
        </Fieldset>

        <Fieldset legend="The event" es="La fiesta">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField name="eventDate" type="date" label="Event date" min={minDate} required defaultValue={val('eventDate')} error={err.eventDate} />
            <TextField name="startTime" type="time" label="Start time" required defaultValue={val('startTime')} error={err.startTime} />
            <SelectField name="durationHours" label="How long" options={DURATIONS} placeholder="Choose…" required defaultValue={val('durationHours') ?? ''} error={err.durationHours} />
          </div>
          <TextField name="location" label="Location or address" autoComplete="street-address" required defaultValue={val('location')} error={err.location} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              name="guestCount"
              type="number"
              inputMode="numeric"
              min={10}
              max={2000}
              label="Estimated guests"
              hint="10 or more"
              required
              defaultValue={val('guestCount')}
              error={err.guestCount}
            />
            <SelectField name="eventType" label="Event type" options={EVENT_TYPES} placeholder="Choose…" required defaultValue={val('eventType') ?? ''} error={err.eventType} />
          </div>
        </Fieldset>

        <Fieldset legend="Food & service" es="La comida">
          <RadioGroup name="serviceStyle" legend="Service style" options={SERVICE_STYLES} value={val('serviceStyle')} error={err.serviceStyle} />
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-bold">Menu interests</legend>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {MENU_INTERESTS.map((m) => (
                <Checkbox key={m.value} name="menuInterests" value={m.value} label={m.label} defaultChecked={interests.includes(m.value)} />
              ))}
            </div>
            <FieldError name="menuInterests" error={err.menuInterests} />
          </fieldset>
          <SelectField name="budgetRange" label="Budget range" options={BUDGETS} placeholder="Choose… (optional)" defaultValue={val('budgetRange') ?? ''} error={err.budgetRange} />
          <TextArea
            name="notes"
            label="Anything else?"
            hint="Dietary needs, power/parking at the site, the vibe — whatever helps."
            maxLength={2000}
            defaultValue={val('notes')}
            error={err.notes}
          />
        </Fieldset>

        <div className="flex flex-col gap-2 border-t-2 border-dashed border-surface-2 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-muted">We reply within 2 business days. Sending this doesn’t book anything.</p>
          <Button type="submit" size="lg" loading={pending} className="shrink-0">
            Send request
          </Button>
        </div>
      </form>
    </div>
  );
}

function Fieldset({ legend, es, children }: { legend: string; es: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-2 flex items-baseline gap-3">
        <span className="relative font-display text-h3 uppercase">
          {legend}
          <Underline className="absolute -bottom-1.5 left-0 h-2.5 w-full text-marigold" />
        </span>
        <span aria-hidden className="font-hand text-base text-marigold">
          {es}
        </span>
      </legend>
      {children}
    </fieldset>
  );
}

function RadioGroup({
  name,
  legend,
  options,
  value,
  error,
}: {
  name: string;
  legend: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value?: string | undefined;
  error?: string | undefined;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="mb-1 text-sm font-bold">
        {legend}
        <span aria-hidden className="text-danger"> *</span>
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cx(
              'press shadow-hard-sm flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border-[length:var(--line-thin)] border-outline bg-paper px-3 font-bold text-paper-ink',
              'has-[:checked]:bg-marigold has-[:checked]:text-on-marigold has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]',
              error && 'border-danger-fill',
            )}
          >
            <input type="radio" name={name} value={o.value} defaultChecked={value === o.value} className="h-5 w-5 accent-[#14110e]" />
            {o.label}
          </label>
        ))}
      </div>
      <FieldError name={name} error={error} />
    </fieldset>
  );
}
