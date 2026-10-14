import { StatusIcon } from '@/components/layout/StatusBanner';
import { AdminPage, Card } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth';
import { cx } from '@/lib/cx';
import { dateTime } from '@/lib/format';
import { kitchenLoad } from '@/lib/kitchen';
import { getSettings, getWeeklyHours, orderingState } from '@/lib/status';
import { setOrderingPaused, setStatus } from './actions';
import { HoursForm, LocationForm, MessagesForm } from './forms';

const OPTIONS = [
  { value: 'open', label: 'Open now', hint: 'Online ordering on', cls: 'bg-agave text-on-agave' },
  { value: 'back_soon', label: 'Back soon', hint: 'Off the Square for now', cls: 'bg-marigold text-on-marigold' },
  { value: 'closed', label: 'Closed', hint: 'Closed tonight', cls: 'bg-danger-fill text-on-chile' },
] as const;

export default async function StatusAdminPage() {
  await requireAdmin();
  const [settings, hours, load] = await Promise.all([getSettings(), getWeeklyHours(), kitchenLoad()]);
  const ordering = await orderingState(settings);

  return (
    <AdminPage title="Status">
      <Card title="Are you open?">
        <div className="grid gap-3 sm:grid-cols-3">
          {OPTIONS.map((o) => {
            const active = settings.status === o.value;
            return (
              <form key={o.value} action={setStatus.bind(null, o.value)}>
                <button
                  type="submit"
                  aria-pressed={active}
                  className={cx(
                    'press flex min-h-20 w-full flex-col items-start justify-center gap-1 rounded-md border-[length:var(--line)] border-outline px-4 text-left',
                    active ? `${o.cls} shadow-hard` : 'bg-surface-2 text-ink',
                  )}
                >
                  <span className="flex items-center gap-2 font-display text-lg uppercase">
                    <StatusIcon status={o.value} />
                    {o.label}
                    {active ? <span className="text-sm">✓</span> : null}
                  </span>
                  <span className="text-sm font-bold opacity-80">{o.hint}</span>
                </button>
              </form>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-ink-muted">Last changed {dateTime(settings.updatedAt)}. Updates the whole site instantly.</p>
      </Card>

      <Card title="Online ordering">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-lg font-bold">
              {settings.status !== 'open'
                ? 'Off — the truck isn’t open.'
                : settings.orderingPaused
                  ? 'Paused — customers see your pause message.'
                  : ordering.canOrder
                    ? `Taking orders · about ${ordering.waitMinutes} min wait`
                    : 'Off'}
            </p>
            <p className="text-sm text-ink-muted">
              Kitchen screen: {load ? `${load.activeTickets} tickets on the board` : 'not reachable — using the default wait'}
            </p>
          </div>
          <form action={setOrderingPaused.bind(null, !settings.orderingPaused)}>
            <button
              type="submit"
              className={cx(
                'press shadow-hard min-h-14 rounded-md border-[length:var(--line)] border-outline px-5 font-display text-lg uppercase',
                settings.orderingPaused ? 'bg-agave text-on-agave' : 'bg-danger-fill text-on-chile',
              )}
            >
              {settings.orderingPaused ? 'Resume orders' : 'Pause orders'}
            </button>
          </form>
        </div>
      </Card>

      <Card title="Messages">
        <MessagesForm settings={settings} />
      </Card>

      <Card title="Weekly hours">
        <HoursForm hours={hours} />
      </Card>

      <Card title="Location & links">
        <LocationForm settings={settings} />
      </Card>
    </AdminPage>
  );
}
