'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { broadcastAction, type BroadcastState } from './actions';

type SpecialOption = { id: string; title: string };

const INPUT = 'w-full rounded-sm border-2 border-outline bg-paper p-3 text-paper-ink';

export function BroadcastComposer({ specials }: { specials: SpecialOption[] }) {
  const [state, action, pending] = useActionState<BroadcastState, FormData>(broadcastAction, { step: 'compose' });

  if (state.step === 'sent') {
    return (
      <div className="flex flex-col gap-3" role="status">
        <p className="rounded-sm border-2 border-outline bg-agave p-3 font-bold text-on-agave">
          Sent: {state.emailCount} emails, {state.smsCount} texts.
        </p>
        <form action={action}>
          <input type="hidden" name="intent" value="edit" />
          <Button type="submit" variant="paper" size="sm">
            New broadcast
          </Button>
        </form>
      </div>
    );
  }

  const v = state.values ?? {};
  const hidden = (
    <>
      <input type="hidden" name="subject" value={String(v.subject ?? '')} />
      <input type="hidden" name="body" value={String(v.body ?? '')} />
      <input type="hidden" name="specialId" value={String(v.specialId ?? '')} />
      {v.sendEmail ? <input type="hidden" name="sendEmail" value="yes" /> : null}
      {v.sendSms ? <input type="hidden" name="sendSms" value="yes" /> : null}
    </>
  );

  if (state.step === 'preview') {
    const total = state.emailRecipients + state.smsRecipients;
    return (
      <div className="flex flex-col gap-4">
        <p className="font-bold">
          This will go to {state.emailRecipients} email and {state.smsRecipients} text subscribers. It can’t be unsent.
        </p>
        {v.sendSms ? (
          <div>
            <p className="text-sm font-bold text-ink-muted">Text ({state.sms.length} characters{state.sms.length > 160 ? ', sent as several segments' : ''})</p>
            <p className="mt-1 max-w-sm rounded-lg rounded-bl-none border-2 border-outline bg-surface-2 p-3">{state.sms}</p>
          </div>
        ) : null}
        {v.sendEmail ? (
          <div>
            <p className="text-sm font-bold text-ink-muted">Email</p>
            <div className="mt-1 rounded-sm border-2 border-outline bg-paper p-3 text-paper-ink">
              <p className="font-bold">{state.emailSubject}</p>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{state.emailText}</pre>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <form action={action}>
            {hidden}
            <input type="hidden" name="intent" value="send" />
            <Button type="submit" loading={pending} disabled={total === 0}>
              Send to {total}
            </Button>
          </form>
          <form action={action}>
            {hidden}
            <input type="hidden" name="intent" value="edit" />
            <Button type="submit" variant="paper">
              Edit
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error ? (
        <p role="alert" className="rounded-sm border-2 border-outline bg-danger-fill p-3 font-bold text-on-chile">
          {state.error}
        </p>
      ) : null}
      <input type="hidden" name="intent" value="preview" />
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-1 text-sm font-bold">Send by</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="sendEmail" value="yes" defaultChecked={v.sendEmail !== false} className="h-5 w-5" /> Email
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="sendSms" value="yes" defaultChecked={Boolean(v.sendSms)} className="h-5 w-5" /> Text
        </label>
      </fieldset>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">Email subject</span>
        <input name="subject" defaultValue={String(v.subject ?? '')} maxLength={150} className={INPUT} placeholder="We’re back on the Square Friday!" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">Message</span>
        <textarea name="body" rows={4} maxLength={600} defaultValue={String(v.body ?? '')} className={INPUT} placeholder="We’re back on the Square Friday, 8:30 PM. First 20 orders get free elote." />
        <span className="text-sm text-ink-muted">Texts start with “Barrio Burger Co:” and end with the link and “Reply STOP to opt out”.</span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">Attach a special (optional)</span>
        <select name="specialId" defaultValue={String(v.specialId ?? '')} className={INPUT}>
          <option value="">None</option>
          {specials.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" loading={pending} className="self-start">
        Preview
      </Button>
    </form>
  );
}
