'use client';

import type { DayHoursDto, SiteSettingsDto, TruckStatus } from '@barrio/site-contract';
import { ActionForm, FieldError } from '@/components/website/ActionForm';
import { Field, inputClass, PrimaryButton } from '@/components/dashboard/form';
import { textareaClass } from '@/components/website/ui';
import { saveHours, saveLocation, saveMessages, setPaused, setStatus } from './actions';

const OPTIONS: Array<{ value: TruckStatus; label: string; hint: string; fill: string; ink: string }> = [
  { value: 'open', label: 'Open now', hint: 'Online ordering on', fill: 'var(--success)', ink: '#fff' },
  { value: 'back_soon', label: 'Back soon', hint: 'Off the Square for now', fill: 'var(--status-amber)', ink: '#1a1206' },
  { value: 'closed', label: 'Closed', hint: 'Closed tonight', fill: 'var(--danger)', ink: '#fff' },
];

export function StatusButtons({ current }: { current: TruckStatus }): React.JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {OPTIONS.map((o) => {
        const active = current === o.value;
        return (
          <ActionForm key={o.value} action={setStatus.bind(null, o.value)}>
            <button
              type="submit"
              aria-pressed={active}
              className="flex min-h-20 w-full flex-col items-start justify-center gap-0.5 rounded-[var(--radius-lg)] border border-[var(--rule)] px-4 text-left transition-colors hover:border-[var(--ink-3)]"
              style={active ? { background: o.fill, color: o.ink, borderColor: o.fill } : undefined}
            >
              <span className="text-lg font-semibold">
                {o.label}
                {active ? ' ✓' : ''}
              </span>
              <span className={`text-sm ${active ? 'opacity-90' : 'text-ink-3'}`}>{o.hint}</span>
            </button>
          </ActionForm>
        );
      })}
    </div>
  );
}

export function PauseToggle({ paused, disabled }: { paused: boolean; disabled: boolean }): React.JSX.Element {
  return (
    <ActionForm action={setPaused.bind(null, !paused)}>
      <button
        type="submit"
        disabled={disabled}
        className={`rounded-[var(--radius)] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
          paused ? 'bg-accent text-accent-ink hover:opacity-90' : 'border border-[var(--danger)] text-danger hover:bg-[var(--danger)] hover:text-white'
        }`}
      >
        {paused ? 'Resume online orders' : 'Pause online orders'}
      </button>
    </ActionForm>
  );
}

export function MessagesForm({ settings }: { settings: SiteSettingsDto }): React.JSX.Element {
  return (
    <ActionForm action={saveMessages} className="grid gap-4">
      <Field label="Message under the status banner" hint="e.g. “Back on the Square Friday at 8:30”. Blank for none.">
        <textarea name="statusMessage" defaultValue={settings.statusMessage ?? ''} maxLength={200} className={textareaClass} />
        <FieldError name="statusMessage" />
      </Field>
      <Field label="Shown while online orders are paused">
        <textarea name="pausedMessage" defaultValue={settings.pausedMessage ?? ''} maxLength={200} className={textareaClass} />
        <FieldError name="pausedMessage" />
      </Field>
      <Field label="Default wait (minutes)" hint="Used when the kitchen screen can’t be reached." className="max-w-48">
        <input name="defaultWaitMinutes" type="number" min={3} max={90} required defaultValue={settings.defaultWaitMinutes} className={inputClass} />
        <FieldError name="defaultWaitMinutes" />
      </Field>
      <div>
        <PrimaryButton>Save messages</PrimaryButton>
      </div>
    </ActionForm>
  );
}

export function LocationForm({ settings }: { settings: SiteSettingsDto }): React.JSX.Element {
  const field = (name: keyof SiteSettingsDto, label: string, hint?: string, max = 120) => (
    <Field label={label} {...(hint ? { hint } : {})}>
      <input name={name} defaultValue={String(settings[name] ?? '')} maxLength={max} className={inputClass} />
      <FieldError name={name} />
    </Field>
  );
  return (
    <ActionForm action={saveLocation} className="grid gap-4 sm:grid-cols-2">
      {field('locationName', 'Spot name', 'Shown on Find Us', 80)}
      {field('address', 'Address')}
      {field('lat', 'Map pin latitude', 'Like 29.8830', 20)}
      {field('lng', 'Map pin longitude', 'Like -97.9411', 20)}
      {field('phone', 'Phone (optional)', undefined, 30)}
      {field('instagram', 'Instagram handle', 'Without the @', 31)}
      <Field label="Late-night note" className="sm:col-span-2">
        <textarea name="lateNightNote" defaultValue={settings.lateNightNote ?? ''} maxLength={240} className={textareaClass} />
        <FieldError name="lateNightNote" />
      </Field>
      <div className="sm:col-span-2">
        <PrimaryButton>Save location</PrimaryButton>
      </div>
    </ActionForm>
  );
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function HoursForm({ hours }: { hours: DayHoursDto[] }): React.JSX.Element {
  return (
    <ActionForm action={saveHours}>
      {/* Phones: day + closed + times on one row, note underneath. sm+: one row each. */}
      <div className="text-sm">
        <div className="hidden grid-cols-[7rem_4rem_8rem_8rem_1fr] gap-3 pb-1 text-xs uppercase tracking-wide text-ink-3 sm:grid">
          <span>Day</span>
          <span>Closed</span>
          <span>Opens</span>
          <span>Closes</span>
          <span>Note</span>
        </div>
        {DAYS.map((name, d) => {
          const h = hours.find((x) => x.dayOfWeek === d);
          return (
            <div
              key={d}
              className="grid grid-cols-[2.5rem_1rem_1fr_1fr] items-center gap-x-2.5 sm:gap-x-3 gap-y-1 border-t border-[var(--rule)] py-2 sm:grid-cols-[7rem_4rem_8rem_8rem_1fr]"
            >
              <span className="font-medium text-ink">
                <span className="sm:hidden">{name.slice(0, 3)}</span>
                <span className="hidden sm:inline">{name}</span>
              </span>
              <input type="checkbox" name={`closed-${d}`} defaultChecked={h?.closed ?? false} aria-label={`${name} closed`} className="size-4 accent-[var(--accent)]" />
              <input type="time" name={`opens-${d}`} defaultValue={h?.opens ?? ''} aria-label={`${name} opens`} className={`${inputClass} w-full`} />
              <input type="time" name={`closes-${d}`} defaultValue={h?.closes ?? ''} aria-label={`${name} closes`} className={`${inputClass} w-full`} />
              <input
                name={`note-${d}`}
                defaultValue={h?.note ?? ''}
                maxLength={60}
                aria-label={`${name} note`}
                placeholder="Note (optional)"
                className={`${inputClass} col-span-4 w-full sm:col-span-1`}
              />
              <span className="col-span-4 empty:hidden sm:col-span-5">
                <FieldError name={`day-${d}`} />
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-3">Closing times after midnight belong to the night they started (Friday 03:00 = early Saturday).</p>
      <div className="mt-3">
        <PrimaryButton>Save hours</PrimaryButton>
      </div>
    </ActionForm>
  );
}
