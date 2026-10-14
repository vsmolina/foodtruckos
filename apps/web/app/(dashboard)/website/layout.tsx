import { siteConfigured, sitePage } from '@/lib/site/api';
import { WebsiteTabs } from '@/components/website/WebsiteTabs';
import { ButtonLink, Panel } from '@/components/website/ui';

// Website section: everything customer-facing on the Barrio website, edited
// through the site's admin API. Food items themselves live under Menu (they go
// to Square, and the website picks them up from there).
export default function WebsiteLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  const connected = siteConfigured();
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-3xl text-ink">Website</h1>
        {connected ? (
          <ButtonLink href={sitePage('/')} external>
            View the site ↗
          </ButtonLink>
        ) : null}
      </div>
      <WebsiteTabs />
      <div className="mt-6">
        {connected ? (
          children
        ) : (
          <Panel title="The website isn’t connected">
            <p className="text-sm text-ink-2">
              Add <code className="font-mono">SITE_URL</code> and <code className="font-mono">SITE_ADMIN_API_TOKEN</code> to this
              app’s <code className="font-mono">.env</code>. The token must match <code className="font-mono">SITE_ADMIN_API_TOKEN</code>{' '}
              on the website. Generate one with <code className="font-mono">openssl rand -hex 32</code>.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}
