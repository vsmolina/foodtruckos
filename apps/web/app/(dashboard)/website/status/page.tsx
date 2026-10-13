import { dateTime } from '@/lib/format';
import { siteData } from '@/lib/site/api';
import { Panel, Pill } from '@/components/website/ui';
import { HoursForm, LocationForm, MessagesForm, PauseToggle, StatusButtons } from './StatusForms';

export const dynamic = 'force-dynamic';

export default async function WebsiteStatusPage(): Promise<React.JSX.Element> {
  const { settings, hours, ordering } = await siteData('status.get', {});

  const orderingLine = ordering.canOrder
    ? `On — customers see “Ready in ~${ordering.waitMinutes} min”.`
    : ordering.reason === 'paused'
      ? 'Paused — customers see your pause message and order at the window.'
      : 'Off — the truck isn’t open.';

  return (
    <div className="grid gap-6">
      <Panel title="Are you open?" description={`Last changed ${dateTime(settings.updatedAt)}. The whole website updates right away.`}>
        <StatusButtons current={settings.status} />
      </Panel>

      <Panel title="Online ordering">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="flex items-center gap-2 text-ink">
            <Pill tone={ordering.canOrder ? 'ok' : ordering.reason === 'paused' ? 'warn' : 'neutral'}>
              {ordering.canOrder ? 'Taking orders' : ordering.reason === 'paused' ? 'Paused' : 'Off'}
            </Pill>
            <span className="text-sm text-ink-2">{orderingLine}</span>
          </p>
          <PauseToggle paused={settings.orderingPaused} disabled={settings.status !== 'open' && !settings.orderingPaused} />
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Messages">
          <MessagesForm settings={settings} />
        </Panel>
        <Panel title="Location" description="Find Us page, map and search listing.">
          <LocationForm settings={settings} />
        </Panel>
      </div>

      <Panel title="Weekly hours" description="Shown on the website. Open/closed above is still set by hand.">
        <HoursForm hours={hours} />
      </Panel>
    </div>
  );
}
