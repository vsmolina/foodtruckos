'use client';

import { createContext, startTransition, useActionState, useContext } from 'react';
import type { FormState } from '@/lib/site/form';
import { NoticeBanner } from '@/components/dashboard/form';

// A form whose server action returns FormState: shows the result banner and
// lets <FieldError name> show the website's per-field messages. Works without
// JS too (progressive enhancement via useActionState + form action).

const ErrorsContext = createContext<FormState['fieldErrors']>(undefined);

export function ActionForm({
  action,
  children,
  className = '',
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  /**
   * Ignored: React sets multipart encoding itself for server-action forms,
   * and passing encType logs an error. Kept so callers that pass it compile.
   */
  encType?: 'multipart/form-data';
}): React.JSX.Element {
  const [state, formAction, pending] = useActionState(action, {});
  const notice = state.error ? { tone: 'error' as const, text: state.error } : state.ok ? { tone: 'ok' as const, text: state.ok } : null;
  return (
    <form
      action={formAction}
      // React resets a form after its action runs, which would wipe what the
      // owner typed when the website rejects a field. With JS, submit by hand
      // so inputs keep their values; without JS, `action` still works.
      onSubmit={(e) => {
        const submitter = (e.nativeEvent as SubmitEvent).submitter;
        // A button with its own formAction runs a different action: let React handle it.
        if (submitter?.hasAttribute('formaction')) return;
        e.preventDefault();
        const fd = new FormData(e.currentTarget, submitter);
        startTransition(() => formAction(fd));
      }}
      className={className}
      aria-busy={pending || undefined}
    >
      <ErrorsContext.Provider value={state.fieldErrors}>
        <fieldset disabled={pending} className="contents">
          {children}
        </fieldset>
      </ErrorsContext.Provider>
      <NoticeBanner key={state.at} notice={notice} />
    </form>
  );
}

export function FieldError({ name }: { name: string }): React.JSX.Element | null {
  const errors = useContext(ErrorsContext);
  const msg = errors?.[name];
  if (!msg) return null;
  return (
    <span role="alert" className="text-xs text-danger">
      {msg}
    </span>
  );
}
