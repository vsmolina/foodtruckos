import type { Metadata } from 'next';
import { StatusIcon } from '@/components/layout/StatusBanner';
import { buttonClass } from '@/components/ui/Button';
import { Arrow } from '@/components/ui/Doodles';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Sticker } from '@/components/ui/Sticker';
import { cx } from '@/lib/cx';
import { DAY_ES, DAY_NAMES, hhmm } from '@/lib/format';
import { JsonLd, foodEstablishment } from '@/lib/jsonld';
import { getSettings, getWeeklyHours, todaysHours } from '@/lib/status';

export const metadata: Metadata = {
  title: 'Find us',
  description: 'Barrio Burger Co. parks on the Square in San Marcos, TX, behind Harper’s. Weekly hours, map and late-night times.',
};

export default async function FindUsPage() {
  const [settings, hours] = await Promise.all([getSettings(), getWeeklyHours()]);
  const today = todaysHours(hours);
  const lat = Number(settings.lat);
  const lng = Number(settings.lng);
  const d = 0.004;
  const osm = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d / 1.6},${lng + d},${lat + d / 1.6}&layer=mapnik&marker=${lat},${lng}`;
  const q = encodeURIComponent(`${lat},${lng}`);
  // Mon-first week reads naturally for a late-night business.
  const week = [1, 2, 3, 4, 5, 6, 0].map((dow) => hours.find((h) => h.dayOfWeek === dow) ?? { dayOfWeek: dow, opens: null, closes: null, closed: true, note: null });

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <JsonLd data={foodEstablishment(settings, hours)} />
      <SectionHeading as="h1" size="h1" kicker="¿Dónde andamos?">
        Find the truck
      </SectionHeading>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        {/* Map: a framed panel. The OSM iframe is lazy so weak signal loads the address first. */}
        <div className="flex flex-col gap-4">
          <div className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-[length:var(--line)] border-outline bg-paper p-4 text-paper-ink">
              <div>
                <p className="font-display text-h3 uppercase">{settings.locationName}</p>
                <p>{settings.address}</p>
              </div>
              <Sticker tone={settings.status === 'open' ? 'agave' : settings.status === 'back_soon' ? 'marigold' : 'chile'} tilt="d">
                <StatusIcon status={settings.status} />
                {settings.status === 'open' ? 'Here now' : settings.status === 'back_soon' ? 'Back soon' : 'Closed'}
              </Sticker>
            </div>
            <iframe
              title={`Map: ${settings.locationName}`}
              src={osm}
              loading="lazy"
              className="block aspect-[4/3] w-full border-0 bg-surface-2 sm:aspect-[16/10]"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <a className={buttonClass('primary', 'md', 'whitespace-nowrap px-3 text-sm')} href={`https://maps.apple.com/?ll=${lat},${lng}&q=Barrio%20Burger%20Co.`}>
              Apple Maps
            </a>
            <a className={buttonClass('paper', 'md', 'whitespace-nowrap px-3 text-sm')} href={`https://www.google.com/maps/dir/?api=1&destination=${q}`}>
              Google Maps
            </a>
          </div>
          {settings.statusMessage && settings.status !== 'open' ? (
            <p className="paper tilt-c p-4 text-lg font-bold">{settings.statusMessage}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-8">
          <section aria-labelledby="hours-h" className="paper tilt-b p-5">
            <h2 id="hours-h" className="font-display text-h3 uppercase">Hours</h2>
            <p className="font-hand text-lg text-[#b3261e]">Abrimos de noche</p>
            <table className="mt-3 w-full text-base">
              <caption className="sr-only">Weekly hours</caption>
              <tbody>
                {week.map((h) => {
                  const isToday = today?.dayOfWeek === h.dayOfWeek;
                  return (
                    <tr key={h.dayOfWeek} className={cx('border-b-2 border-dashed border-[#d8ccb8] last:border-0', isToday && 'font-bold')}>
                      <th scope="row" className="py-2 pr-2 text-left font-bold">
                        {DAY_NAMES[h.dayOfWeek]}
                        <span className="ml-2 hidden font-hand text-sm font-normal text-[#5e5248] sm:inline">{DAY_ES[h.dayOfWeek]}</span>
                        {isToday ? <span className="ml-2 rounded-sm bg-marigold px-1.5 text-xs uppercase text-on-marigold">Today</span> : null}
                      </th>
                      <td className="py-2 text-right tabular-nums">
                        {h.closed || !h.opens ? <span className="text-[#5e5248]">Closed</span> : <span className="whitespace-nowrap">{`${hhmm(h.opens)} – ${hhmm(h.closes)}`}</span>}
                        {h.note ? <span className="block text-sm font-normal text-[#5e5248]">{h.note}</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-sm text-[#5e5248]">Hours can change with events and weather — the banner at the top of every page is always current.</p>
          </section>

          <section className="panel relative bg-anil p-5 text-on-anil">
            <p className="font-hand text-xl">De madrugada</p>
            <h2 className="font-display text-h3 uppercase">Late-night peak</h2>
            <p className="mt-2 text-lg">
              {settings.lateNightNote ?? 'We’re busiest right after last call. Order ahead from the bar and walk over when it’s ready.'}
            </p>
            <Arrow className="draw absolute -bottom-6 right-6 h-12 w-16 rotate-90 text-marigold" />
          </section>

          <section className="panel p-5">
            <h2 className="font-display text-h3 uppercase">Getting here</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-muted">
              <li>We park on the downtown Square, behind Harper’s.</li>
              <li>Walk up to the window to order, or order ahead and skip the line.</li>
              <li>Pick up at the window — say the code on your order screen.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
