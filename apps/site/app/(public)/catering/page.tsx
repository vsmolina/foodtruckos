import type { Metadata } from 'next';
import { Arrow } from '@/components/ui/Doodles';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { PhotoSlot } from '@/components/ui/Slots';
import { Sticker } from '@/components/ui/Sticker';
import { todayISO } from '@/lib/catering';
import { CateringForm } from './CateringForm';

export const metadata: Metadata = {
  title: 'Catering & private events',
  description: 'Bring the Barrio Burger Co. truck to your party, wedding, office or bar event in San Marcos and around Central Texas — or get a drop-off spread.',
};

export default function CateringPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10">
      <SectionHeading as="h1" size="h1" kicker="Eventos y fiestas" underline="rosa">
        Catering &amp; private events
      </SectionHeading>
      <p className="mt-6 max-w-2xl text-lg">
        Mexican-style burgers and bacon-wrapped dogs for your party, wedding, office or bar night. We roll up with the truck, or drop off a spread
        that feeds the crowd.
      </p>

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <article className="paper taped tilt-a relative flex flex-col gap-3 p-5 pt-7">
          <Sticker tone="agave" tilt="e" className="absolute -left-2 -top-4">
            ¡Con todo!
          </Sticker>
          <div className="aspect-[16/9] overflow-hidden border-[length:var(--line-thin)] border-outline">
            <PhotoSlot label="the truck at an event" tone="agave" />
          </div>
          <h2 className="font-display text-h3 uppercase">Truck on site</h2>
          <p>We park, fire up the grill and cook to order — the full late-night experience at your event. Best for 50+ guests with room to park.</p>
        </article>
        <article className="paper taped tilt-b relative flex flex-col gap-3 p-5 pt-7">
          <Sticker tone="marigold" tilt="d" className="absolute -left-2 -top-4">
            Para llevar
          </Sticker>
          <div className="aspect-[16/9] overflow-hidden border-[length:var(--line-thin)] border-outline">
            <PhotoSlot label="a drop-off spread" tone="marigold" />
          </div>
          <h2 className="font-display text-h3 uppercase">Drop-off</h2>
          <p>Burgers, dogs and sides packed hot and delivered on time. Great for offices, game nights and smaller parties.</p>
        </article>
      </div>

      <div className="mt-16 grid gap-8 lg:grid-cols-[1fr_2fr]">
        <div className="flex flex-col gap-3">
          <SectionHeading kicker="Cuéntanos" underline="agave">
            Request a quote
          </SectionHeading>
          <p className="mt-3 text-lg">Tell us about the event. Required fields are marked *. We’ll follow up with a quote.</p>
          <div aria-hidden className="hidden items-start gap-2 pt-4 text-marigold lg:flex">
            <span className="font-hand text-xl leading-tight tilt-a">
              llénalo
              <br />y nos vemos
            </span>
            <Arrow className="draw h-16 w-24" />
          </div>
        </div>
        <CateringForm minDate={todayISO()} />
      </div>
    </div>
  );
}
