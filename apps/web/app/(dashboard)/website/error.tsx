'use client';

import { Panel } from '@/components/website/ui';

// Shown when a tab can't load its data from the website (offline, timeout,
// website error). The message comes from lib/site/api.ts.
export default function WebsiteError({ error, reset }: { error: Error; reset: () => void }): React.JSX.Element {
  const known = error.name === 'SiteUnavailableError' || /website/i.test(error.message);
  return (
    <Panel title="Couldn’t load this from the website">
      <p role="alert" className="text-sm text-ink-2">
        {known ? error.message : 'Something went wrong loading this tab.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-3 rounded-[var(--radius)] border border-[var(--rule)] px-3 py-1.5 text-sm text-ink-2 hover:bg-bg-sunken"
      >
        Try again
      </button>
    </Panel>
  );
}
