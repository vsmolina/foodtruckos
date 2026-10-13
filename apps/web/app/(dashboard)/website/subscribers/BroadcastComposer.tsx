'use client';

import { useActionState } from 'react';
import { Field, inputClass, NoticeBanner, PrimaryButton, QuietButton } from '@/components/dashboard/form';
import { selectClass, textareaClass } from '@/components/website/ui';
import { broadcastAction, type ComposerState, type ComposerValues } from './actions';

function Hidden({ v }: { v: ComposerValues }): React.JSX.Element {
  return (
    <>
      <input type="hidden" name="subject" value={v.subject} />
      <input type="hidden" name="body" value={v.body} />
      <input type="hidden" name="specialId" value={v.specialId} />
      {v.sendEmail ? <input type="hidden" name="sendEmail" value="on" /> : null}
      {v.sendSms ? <input type="hidden" name="sendSms" value="on" /> : null}
    </>
  );
}

const err = (msg: string | undefined) =>
  msg ? (
    <span role="alert" className="text-xs text-danger">
      {msg}
    </span>
  ) : null;

export function BroadcastComposer({ specials }: { specials: Array<{ id: string; title: string }> }): React.JSX.Element {
  const [state, action, pending] = useActionState<ComposerState, FormData>(broadcastAction, { step: 'compose' });

  if (state.step === 'sent') {
    return (
      <form action={action} className="grid gap-3">
        <NoticeBanner notice={{ tone: 'ok', text: `Sent: ${state.emailCount} emails, ${state.smsCount} texts.` }} />
        <input type="hidden" name="intent" value="new" />
        <div>
          <QuietButton>Write another</QuietButton>
        </div>
      </form>
    );
  }

  if (state.step === 'preview') {
    const { preview: p, values: v } = state;
    const total = p.emailRecipients + p.smsRecipients;
    return (
      <div className="grid gap-4" aria-busy={pending || undefined}>
        <p className="text-sm text-ink">
          This goes to <strong>{p.emailRecipients}</strong> email and <strong>{p.smsRecipients}</strong> text subscribers — only people who opted in. It can’t be unsent.
        </p>
        {v.sendSms ? (
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-3">
              Text · {p.smsChars} characters · {p.smsSegments} segment{p.smsSegments === 1 ? '' : 's'} per person
              {p.smsRecipients ? ` (${p.smsSegments * p.smsRecipients} billed)` : ''}
            </p>
            <p className="mt-1 max-w-sm whitespace-pre-wrap rounded-[var(--radius-lg)] rounded-bl-none border border-[var(--rule)] bg-bg-sunken p-3 text-sm text-ink">{p.sms}</p>
          </div>
        ) : null}
        {v.sendEmail ? (
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-3">Email</p>
            <div className="mt-1 rounded-[var(--radius)] border border-[var(--rule)] p-3">
              <p className="text-sm font-medium text-ink">{p.emailSubject}</p>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink-2">{p.emailText}</pre>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <form action={action}>
            <Hidden v={v} />
            <input type="hidden" name="intent" value="send" />
            <button
              type="submit"
              disabled={pending || total === 0}
              className="rounded-[var(--radius)] bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'Sending…' : `Send to ${total} ${total === 1 ? 'person' : 'people'}`}
            </button>
          </form>
          <form action={action}>
            <Hidden v={v} />
            <input type="hidden" name="intent" value="edit" />
            <QuietButton>Edit</QuietButton>
          </form>
        </div>
      </div>
    );
  }

  const v = state.values;
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4" aria-busy={pending || undefined}>
      <input type="hidden" name="intent" value="preview" />
      <fieldset>
        <legend className="mb-1 text-xs uppercase tracking-wide text-ink-3">Send by</legend>
        <div className="flex flex-wrap gap-4 text-sm text-ink">
          <label className="flex min-h-9 items-center gap-2">
            <input type="checkbox" name="sendEmail" defaultChecked={v ? v.sendEmail : true} className="size-4 accent-[var(--accent)]" /> Email
          </label>
          <label className="flex min-h-9 items-center gap-2">
            <input type="checkbox" name="sendSms" defaultChecked={v?.sendSms ?? false} className="size-4 accent-[var(--accent)]" /> Text
          </label>
        </div>
        {err(fe.sendEmail)}
      </fieldset>
      <Field label="Email subject">
        <input name="subject" defaultValue={v?.subject ?? ''} maxLength={150} placeholder="We’re back on the Square Friday!" className={inputClass} />
        {err(fe.subject)}
      </Field>
      <Field label="Message" hint="Texts start with “Barrio Burger Co:” and end with the link and “Reply STOP to opt out”.">
        <textarea
          name="body"
          rows={4}
          maxLength={600}
          defaultValue={v?.body ?? ''}
          placeholder="We’re back on the Square Friday, 8:30 PM. First 20 orders get free elote."
          className={textareaClass}
        />
        {err(fe.body)}
      </Field>
      <Field label="Attach a special (optional)">
        <select name="specialId" defaultValue={v?.specialId ?? ''} className={selectClass}>
          <option value="">None</option>
          {specials.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        {err(fe.specialId)}
      </Field>
      <div>
        <PrimaryButton>{pending ? 'Preparing preview…' : 'Preview'}</PrimaryButton>
      </div>
      <NoticeBanner notice={state.error ? { tone: 'error', text: state.error } : null} />
    </form>
  );
}
