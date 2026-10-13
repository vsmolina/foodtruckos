import type { Metadata } from 'next';
import { LiteYouTube } from '@/components/story/LiteYouTube';
import { LinkButton } from '@/components/ui/Button';
import { Scribble, Star } from '@/components/ui/Doodles';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { LogoSlot, PhotoSlot } from '@/components/ui/Slots';
import { Sticker } from '@/components/ui/Sticker';
import { cx } from '@/lib/cx';
import { RAICES_EPISODES } from '@/lib/story';

export const metadata: Metadata = {
  title: 'Our story · Raíces',
  description: 'Mexican street-burger culture, our Michoacán roots, and the Raíces / Roots video series.',
};

export default function StoryPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <SectionHeading as="h1" size="h1" kicker="Nuestras raíces" underline="agave">
        Our story
      </SectionHeading>

      {/* Intro: the hamburguesa al carbón */}
      <section className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div className="flex flex-col gap-4 text-lg">
          <p className="font-display text-h3 uppercase leading-tight">
            In Mexico, the best burger in town comes off a <span className="text-marigold">street cart at night.</span>
          </p>
          <p>
            Hamburguesas al carbón, dogos wrapped in bacon, a griddle on the corner when everything else is closed. Piled high —
            ham, cheese, avocado, pickled jalapeños — and eaten standing up. That’s the burger we grew up on, and that’s the one
            we cook on the Square.
          </p>
          <p className="paper tilt-c p-4 text-base">
            <strong>PLACEHOLDER — owner’s story.</strong> Where the family is from in Michoacán, who taught you to cook, how the
            truck started in San Marcos. Two or three short paragraphs, in your own words.
          </p>
        </div>
        <div className="relative">
          <div className="panel tilt-d aspect-[4/5] overflow-hidden">
            <PhotoSlot label="the family / the first truck" tone="agave" />
          </div>
          <Sticker tone="marigold" tilt="e" size="lg" className="absolute -bottom-4 -left-3">
            Michoacán → San Marcos
          </Sticker>
        </div>
      </section>

      {/* Values strip */}
      <section aria-label="What we stand for" className="mt-20 grid gap-4 sm:grid-cols-3">
        {[
          { es: 'Hecho a mano', en: 'Made by hand', body: 'Smashed to order on the griddle. Salsas made in the truck.', tone: 'bg-marigold text-on-marigold', tilt: 'tilt-a' },
          { es: 'Pa’l barrio', en: 'For the neighborhood', body: 'Late nights, fair prices, and a window that stays open after last call.', tone: 'bg-rosa text-on-rosa', tilt: 'tilt-b' },
          { es: 'Sin pena', en: 'No shame, all flavor', body: 'Bacon-wrapped, cheese-loaded, jalapeño-topped. Go big.', tone: 'bg-agave text-on-agave', tilt: 'tilt-c' },
        ].map((v) => (
          <div key={v.en} className={cx('panel flex flex-col gap-1 p-5', v.tone, v.tilt)}>
            <Star className="h-8 w-8 text-paper" />
            <p className="font-hand text-xl">{v.es}</p>
            <h2 className="font-display text-h3 uppercase">{v.en}</h2>
            <p>{v.body}</p>
          </div>
        ))}
      </section>

      {/* Raíces video series */}
      <section aria-labelledby="raices-h" className="mt-20">
        <SectionHeading id="raices-h" kicker="La serie" underline="rosa">
          Raíces / Roots
        </SectionHeading>
        <p className="mt-6 max-w-2xl text-lg text-ink-muted">Short videos about the food, the family and the Square.</p>
        <ul className="mt-8 grid gap-8 md:grid-cols-3">
          {RAICES_EPISODES.map((ep, i) => (
            <li key={ep.number} className={cx('panel overflow-hidden', i === 1 ? 'md:tilt-b' : 'md:tilt-c')}>
              <div className="border-b-[length:var(--line)] border-outline">
                {ep.youtubeId ? (
                  <LiteYouTube id={ep.youtubeId} title={`Raíces ${ep.number}: ${ep.title}`} />
                ) : (
                  <div className="aspect-video">
                    <PhotoSlot label={`episodio ${ep.number} — muy pronto`} tone={(['chile', 'anil', 'marigold'] as const)[i % 3] ?? 'chile'} />
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="font-hand text-lg text-marigold">
                  Episodio {ep.number} · {ep.titleEs}
                </p>
                <h3 className="font-display text-h3 uppercase">{ep.title}</h3>
                <p className="mt-1 text-ink-muted">{ep.blurb}</p>
                {ep.youtubeId ? null : <p className="mt-2 text-sm font-bold">Coming soon</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Coming soon: house products */}
      <section aria-labelledby="soon-h" className="mt-20">
        <SectionHeading id="soon-h" kicker="Ya mero" underline="marigold">
          Coming soon
        </SectionHeading>
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {[
            {
              title: 'Our own hot dogs',
              es: 'Salchicha de la casa',
              body: 'PLACEHOLDER — a house-made dog built for bacon-wrapping. Details, launch date and where to try it first.',
              tone: 'rosa' as const,
            },
            {
              title: 'Bolillo-style buns',
              es: 'Pan bolillo',
              body: 'PLACEHOLDER — a crusty, soft-inside bolillo-style bun for the burgers and dogs. Who’s baking it and when it lands.',
              tone: 'marigold' as const,
            },
          ].map((p, i) => (
            <article key={p.title} className={cx('paper taped grid grid-cols-[7rem_1fr] gap-4 p-4 sm:grid-cols-[9rem_1fr]', i ? 'tilt-b' : 'tilt-a')}>
              <div className="aspect-square overflow-hidden border-[length:var(--line-thin)] border-outline">
                <PhotoSlot label={p.es} tone={p.tone} />
              </div>
              <div>
                <Sticker tone="chile" tilt="d" size="sm">
                  Muy pronto
                </Sticker>
                <h3 className="mt-2 font-display text-h3 uppercase">{p.title}</h3>
                <p className="mt-1 text-base">{p.body}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <Scribble className="draw h-8 w-32 text-marigold" />
          <p className="text-lg">Be the first to try them.</p>
          <LinkButton href="/specials">Get the specials</LinkButton>
        </div>
      </section>

      <div className="mt-16 flex justify-center">
        <LogoSlot size="lg" />
      </div>
    </div>
  );
}
