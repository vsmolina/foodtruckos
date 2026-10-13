import type { Metadata } from 'next';
import { OrderMenu } from '@/components/order/OrderMenu';
import { LinkButton } from '@/components/ui/Button';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Sticker } from '@/components/ui/Sticker';
import { cx } from '@/lib/cx';
import { hhmm } from '@/lib/format';
import { getMenu } from '@/lib/menu';
import { getSettings, getWeeklyHours, orderingState, todaysHours } from '@/lib/status';

export const metadata: Metadata = {
  title: 'Order ahead',
  description: 'Order and pay on your phone, then pick up at the window. Skip the line after last call.',
};

export default async function OrderPage() {
  const [settings, menu, hours] = await Promise.all([getSettings(), getMenu(), getWeeklyHours()]);
  const state = await orderingState(settings);
  const today = todaysHours(hours);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-32 pt-8">
      <SectionHeading as="h1" size="h1" kicker="Pide antes del last call" underline="marigold">
        Order ahead
      </SectionHeading>

      {state.canOrder ? (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Sticker tone="agave" tilt="b" size="lg">
            Ready in ~{state.waitMinutes} min
          </Sticker>
          <p className="text-base">
            Pickup at the window · <span className="font-bold">{settings.locationName}</span>
          </p>
        </div>
      ) : (
        <ClosedNotice
          reason={state.reason}
          message={state.message}
          tonight={today && !today.closed && today.opens ? `${hhmm(today.opens)} – ${hhmm(today.closes)}` : null}
        />
      )}

      <div className="mt-8">
        {menu.length === 0 ? (
          <p className="panel p-6 text-center">The menu is being updated. Check back in a minute.</p>
        ) : (
          <>
            {!state.canOrder ? <p className="mb-2 font-hand text-lg text-marigold">Mira el menú mientras tanto ↓</p> : null}
            <OrderMenu menu={menu} readOnly={!state.canOrder} />
          </>
        )}
      </div>
    </div>
  );
}

function ClosedNotice({
  reason,
  message,
  tonight,
}: {
  reason: 'closed' | 'back_soon' | 'paused';
  message: string | null;
  tonight: string | null;
}) {
  const copy = {
    paused: {
      kicker: '¡Estamos a full!',
      title: 'Online orders paused',
      body: message ?? 'We’re slammed — online orders are paused for a few minutes. Come to the window and we’ll take care of you.',
      tone: 'bg-marigold text-on-marigold',
    },
    back_soon: {
      kicker: '¡Ahorita volvemos!',
      title: 'Back soon',
      body: message ?? 'We’re not on the Square right now, so online ordering is off.',
      tone: 'bg-marigold text-on-marigold',
    },
    closed: {
      kicker: 'Cerrado',
      title: 'We’re closed',
      body: message ?? (tonight ? `Online ordering opens with the truck: tonight ${tonight}.` : 'Online ordering opens when the truck does.'),
      tone: 'bg-danger-fill text-on-chile',
    },
  }[reason];
  return (
    <div role="status" className={cx('panel tilt-c mt-6 flex flex-col gap-3 p-5', copy.tone)}>
      <p className="font-hand text-xl">{copy.kicker}</p>
      <p className="font-display text-h3 uppercase">{copy.title}</p>
      <p className="text-lg font-bold">{copy.body}</p>
      <div className="flex flex-wrap gap-3">
        <LinkButton href="/find-us" variant="paper">
          Hours &amp; map
        </LinkButton>
        {reason !== 'paused' ? (
          <LinkButton href="/specials" variant="paper">
            Text me when you’re open
          </LinkButton>
        ) : null}
      </div>
    </div>
  );
}
