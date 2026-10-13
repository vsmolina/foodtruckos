import Link from 'next/link';
import { SpecialCard } from '@/components/home/SpecialCard';
import { StatusIcon } from '@/components/layout/StatusBanner';
import { LinkButton } from '@/components/ui/Button';
import { Arrow, Circle, ZigzagDivider } from '@/components/ui/Doodles';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { LogoSlot } from '@/components/ui/Slots';
import { Sticker } from '@/components/ui/Sticker';
import { cx } from '@/lib/cx';
import { hhmm, price } from '@/lib/format';
import { JsonLd, foodEstablishment } from '@/lib/jsonld';
import { getActiveSpecials, getMenu } from '@/lib/menu';
import { getSettings, getWeeklyHours, orderingState, todaysHours } from '@/lib/status';

export default async function HomePage() {
  const [settings, hours, specials, menu] = await Promise.all([getSettings(), getWeeklyHours(), getActiveSpecials(), getMenu()]);
  const ordering = await orderingState(settings);
  const today = todaysHours(hours);
  const featured = menu.flatMap((c) => c.items).filter((i) => !i.soldOut).slice(0, 3);
  const status = settings.status;

  return (
    <>
      <JsonLd data={foodEstablishment(settings, hours)} />

      {/* ------------------------------------------------------------ hero */}
      <section className="mx-auto max-w-6xl px-4 pt-8 sm:pt-12">
        <div className="panel relative overflow-hidden bg-chile p-5 text-on-chile sm:p-8 lg:grid lg:grid-cols-[1.4fr_1fr] lg:gap-8 lg:p-12">
          <div className="relative z-10 flex flex-col gap-4">
            <p className="font-hand text-xl tilt-c sm:text-2xl">Hamburguesas al estilo mexicano</p>
            <h1 className="font-display text-hero uppercase text-paper [text-shadow:4px_4px_0_var(--shade)]">
              Late-night <span className="text-marigold">Mexican</span> burgers
            </h1>
            <p className="max-w-xl text-lg font-bold">
              Burgers and bacon-wrapped dogs on the Square in San Marcos, behind Harper’s. Open till after the bars close.
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              {ordering.canOrder ? (
                <LinkButton href="/order" variant="marigold" size="lg">
                  Order ahead
                </LinkButton>
              ) : (
                <LinkButton href={status === 'open' ? '/order' : '/find-us'} variant="marigold" size="lg">
                  {status === 'open' ? 'Order at the window' : 'When we’re open'}
                </LinkButton>
              )}
              <LinkButton href="/menu" variant="paper" size="lg">
                See the menu
              </LinkButton>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-bold">
              <Sticker tone={status === 'open' ? 'agave' : status === 'back_soon' ? 'marigold' : 'paper'} tilt="b" size="lg">
                <StatusIcon status={status} />
                {status === 'open' ? 'Open now' : status === 'back_soon' ? 'Back soon' : 'Closed'}
              </Sticker>
              {ordering.canOrder ? <span>Ready in about {ordering.waitMinutes} min</span> : null}
              {status !== 'back_soon' && today && !today.closed ? (
                <span>
                  Tonight {hhmm(today.opens)} – {hhmm(today.closes)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="relative mt-8 hidden items-center justify-center lg:mt-0 lg:flex">
            <div className="paper tilt-d grid place-items-center p-6">
              <LogoSlot size="xl" />
            </div>
            <div className="absolute -bottom-2 left-0 flex items-end gap-1 text-paper">
              <Arrow className="draw h-14 w-20 -scale-x-100 rotate-[200deg]" />
              <span className="font-hand text-xl leading-tight tilt-a">
                pide antes del
                <br />
                last call
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- back soon note */}
      {status === 'back_soon' ? (
        <section className="mx-auto mt-10 max-w-6xl px-4">
          <div className="paper tilt-c flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="font-display text-h3 uppercase">¡Ahorita volvemos!</p>
              <p className="mt-1 text-lg">{settings.statusMessage ?? 'We’re taking a short break. Back soon.'}</p>
            </div>
            <LinkButton href="/specials" variant="primary" className="shrink-0">
              Text me when you’re back
            </LinkButton>
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------- quick links */}
      <section aria-label="Quick links" className="mx-auto mt-12 max-w-6xl px-4">
        <ul className="grid gap-4 sm:grid-cols-3">
          {[
            { href: '/order', title: 'Order', es: 'Pide ya', body: ordering.canOrder ? `Skip the line · ~${ordering.waitMinutes} min` : 'Pickup at the window', tone: 'bg-marigold text-on-marigold', tilt: 'tilt-a' },
            { href: '/menu', title: 'Menu', es: 'El menú', body: 'Burgers, dogs, antojitos', tone: 'bg-rosa text-on-rosa', tilt: 'tilt-b' },
            { href: '/find-us', title: 'Find us', es: 'Dónde', body: settings.locationName, tone: 'bg-agave text-on-agave', tilt: 'tilt-c' },
          ].map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={cx('press shadow-hard flex min-h-28 flex-col justify-between rounded-md border-[length:var(--line)] border-outline p-4 no-underline', l.tone, l.tilt, 'hover:rotate-0')}
              >
                <span className="font-hand text-lg opacity-90">{l.es}</span>
                <span className="flex items-end justify-between gap-2">
                  <span>
                    <span className="block font-display text-h2 uppercase leading-none">{l.title}</span>
                    <span className="mt-1 block text-sm font-bold">{l.body}</span>
                  </span>
                  <span aria-hidden className="font-display text-h2 leading-none">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------- specials */}
      {specials.length > 0 ? (
        <section className="mx-auto mt-16 max-w-6xl px-4" aria-labelledby="specials-h">
          <SectionHeading id="specials-h" kicker="Especiales de la casa" underline="rosa">
            Tonight’s specials
          </SectionHeading>
          <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {specials.slice(0, 3).map((s, i) => (
              <SpecialCard key={s.id} special={s} index={i} />
            ))}
          </div>
        </section>
      ) : null}

      {/* ----------------------------------------------------- featured */}
      {featured.length > 0 ? (
        <section className="mx-auto mt-16 max-w-6xl px-4" aria-labelledby="featured-h">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeading id="featured-h" kicker="Lo más pedido" underline="agave">
              Crowd favorites
            </SectionHeading>
            <Link href="/menu" className="font-bold text-link underline decoration-2 underline-offset-4">
              Full menu →
            </Link>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {featured.map((item, i) => (
              <li key={item.id} className={cx('panel flex flex-col gap-2 p-4', i === 1 ? 'tilt-b' : 'tilt-c')}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-h3 uppercase">{item.name}</h3>
                  <span className="relative shrink-0 font-display text-h3 text-marigold">
                    {price(item.fromCents)}
                    {i === 0 ? <Circle className="draw absolute -inset-x-3 -inset-y-2 h-[calc(100%+16px)] w-[calc(100%+24px)] text-rosa" /> : null}
                  </span>
                </div>
                {item.taglineEs ? <p className="font-hand text-lg text-marigold">{item.taglineEs}</p> : null}
                {item.description ? <p className="text-ink-muted">{item.description}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ZigzagDivider className="mx-auto mt-16 max-w-6xl px-4" />

      {/* ---------------------------------------------- late-night + signup */}
      <section className="mx-auto mt-12 grid max-w-6xl gap-6 px-4 lg:grid-cols-2">
        <div className="panel bg-anil p-6 text-on-anil">
          <p className="font-hand text-xl">¿Ya cerró el bar?</p>
          <h2 className="mt-1 font-display text-h2 uppercase">After last call</h2>
          <p className="mt-3 text-lg">
            {settings.lateNightNote ?? 'We’re busiest right after the bars close. Order ahead from the bar and walk up when it’s ready.'}
          </p>
          <p className="mt-4">
            <Link href="/find-us" className="font-bold underline decoration-2 underline-offset-4">
              Hours &amp; map →
            </Link>
          </p>
        </div>
        <div className="paper tilt-b flex flex-col justify-between gap-4 p-6">
          <div>
            <p className="font-hand text-xl text-[#b3261e]">¡No te lo pierdas!</p>
            <h2 className="mt-1 font-display text-h2 uppercase">Get the specials</h2>
            <p className="mt-2 text-lg">New items, nights we’re out, and the night we’re back on the Square. Text or email — your call.</p>
          </div>
          <LinkButton href="/specials" variant="primary" className="self-start">
            Sign me up
          </LinkButton>
        </div>
      </section>
    </>
  );
}
