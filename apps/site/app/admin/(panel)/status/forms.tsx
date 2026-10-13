'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox, FormNotice, TextArea, TextField } from '@/components/ui/Field';
import { DAY_NAMES } from '@/lib/format';
import type { DayHours, Settings } from '@/lib/status';
import { saveHours, saveLocation, saveMessages, type ActionState } from './actions';

function Notice({ state }: { state: ActionState }) {
  if (state.error) return <FormNotice tone="error">{state.error}</FormNotice>;
  if (state.ok) return <FormNotice tone="success">{state.ok}</FormNotice>;
  return null;
}

export function MessagesForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveMessages, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      <Notice state={state} />
      <TextArea
        name="statusMessage"
        label="Message under the status banner"
        hint="Shown when closed or back soon. E.g. “Back on the Square Friday at 8:30!”"
        defaultValue={settings.statusMessage ?? ''}
        rows={2}
        maxLength={200}
        error={fe.statusMessage}
      />
      <TextArea
        name="pausedMessage"
        label="Message when online orders are paused"
        defaultValue={settings.pausedMessage ?? ''}
        rows={2}
        maxLength={200}
        error={fe.pausedMessage}
      />
      <TextField
        name="defaultWaitMinutes"
        type="number"
        inputMode="numeric"
        min={3}
        max={90}
        label="Default wait (minutes)"
        hint="Used when the kitchen screen can’t be reached."
        defaultValue={settings.defaultWaitMinutes}
        error={fe.defaultWaitMinutes}
        className="max-w-48"
      />
      <Button type="submit" variant="marigold" loading={pending} className="self-start">
        Save messages
      </Button>
    </form>
  );
}

export function LocationForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveLocation, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Notice state={state} />
      </div>
      <TextField name="locationName" label="Location name" defaultValue={settings.locationName} required error={fe.locationName} />
      <TextField name="address" label="Address" defaultValue={settings.address} required error={fe.address} />
      <TextField name="lat" label="Map latitude" defaultValue={settings.lat} inputMode="decimal" required error={fe.lat} />
      <TextField name="lng" label="Map longitude" defaultValue={settings.lng} inputMode="decimal" required error={fe.lng} />
      <TextField name="phone" label="Public phone (optional)" type="tel" defaultValue={settings.phone ?? ''} error={fe.phone} />
      <TextField name="instagram" label="Instagram handle" defaultValue={settings.instagram} required error={fe.instagram} />
      <TextArea
        name="lateNightNote"
        label="Late-night note (Find Us + Home)"
        defaultValue={settings.lateNightNote ?? ''}
        rows={2}
        className="sm:col-span-2"
        error={fe.lateNightNote}
      />
      <Button type="submit" variant="marigold" loading={pending} className="self-start">
        Save location
      </Button>
    </form>
  );
}

export function HoursForm({ hours }: { hours: DayHours[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveHours, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-3">
      <Notice state={state} />
      <p className="text-sm text-ink-muted">Display only — the status switch above decides whether you’re open. Closing after midnight is fine (e.g. 8:30 PM → 3:00 AM).</p>
      {[1, 2, 3, 4, 5, 6, 0].map((d) => {
        const h = hours.find((x) => x.dayOfWeek === d);
        return (
          <fieldset key={d} className="grid grid-cols-2 gap-2 border-b-2 border-surface-2 pb-3 sm:grid-cols-[8rem_1fr_1fr_1.4fr_auto] sm:items-end">
            <legend className="sr-only">{DAY_NAMES[d]}</legend>
            <p className="col-span-2 font-bold sm:col-span-1 sm:pb-3">{DAY_NAMES[d]}</p>
            <TextField name={`opens-${d}`} type="time" label="Opens" defaultValue={h?.opens ?? '20:30'} />
            <TextField name={`closes-${d}`} type="time" label="Closes" defaultValue={h?.closes ?? '02:00'} />
            <TextField name={`note-${d}`} label="Note" defaultValue={h?.note ?? ''} maxLength={60} className="col-span-2 sm:col-span-1" />
            <Checkbox name={`closed-${d}`} value="on" label="Closed" defaultChecked={h?.closed ?? false} className="col-span-2 sm:col-span-1" />
            {fe[`day-${d}`] ? <p className="col-span-2 text-sm font-bold text-danger">{fe[`day-${d}`]}</p> : null}
          </fieldset>
        );
      })}
      <Button type="submit" variant="marigold" loading={pending} className="self-start">
        Save hours
      </Button>
    </form>
  );
}
