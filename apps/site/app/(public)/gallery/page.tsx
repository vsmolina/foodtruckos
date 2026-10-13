import type { Metadata } from 'next';
import Link from 'next/link';
import { GalleryGrid } from '@/components/gallery/GalleryGrid';
import { InstagramEmbeds } from '@/components/gallery/InstagramEmbeds';
import { LinkButton } from '@/components/ui/Button';
import { Arrow, Star } from '@/components/ui/Doodles';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { PhotoSlot } from '@/components/ui/Slots';
import { Sticker } from '@/components/ui/Sticker';
import { getPublishedPhotos } from '@/lib/gallery/queries';
import { getSettings } from '@/lib/status';

export const metadata: Metadata = {
  title: 'Night on the Square',
  description: 'Photos from late nights at Barrio Burger Co. on the Square in San Marcos. Every photo of a person is posted with their OK.',
};

export default async function GalleryPage() {
  const [photos, settings] = await Promise.all([getPublishedPhotos(), getSettings()]);
  const igUrls = (process.env.INSTAGRAM_EMBED_POST_URLS ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter((u) => /^https:\/\/(www\.)?instagram\.com\/(p|reel)\//.test(u));

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading as="h1" size="h1" kicker="La noche en la plaza" underline="rosa">
          Night on the Square
        </SectionHeading>
        <div className="flex flex-wrap items-center gap-3">
          <LinkButton href="/gallery/submit" variant="marigold">
            Get featured
          </LinkButton>
          <Link href="/gallery/takedown" className="min-h-11 content-center text-sm font-bold underline decoration-2 underline-offset-4">
            Request a photo be taken down
          </Link>
        </div>
      </div>
      <p className="mt-6 max-w-2xl text-lg text-ink-muted">
        The crowd, the grill, the 2 AM line. We only post photos of people who said yes — tag us or upload yours to be featured.
      </p>

      <div className="mt-10">
        {photos.length > 0 ? (
          <GalleryGrid photos={photos} />
        ) : (
          <div className="paper tilt-c relative mx-auto max-w-xl p-6 text-center sm:p-8">
            <Star className="absolute -right-4 -top-5 h-14 w-14 text-marigold" />
            <p className="font-hand text-xl text-[#b3261e]">¡Todavía nada!</p>
            <h2 className="mt-1 font-display text-h3 uppercase">No photos yet</h2>
            <p className="mt-2 text-lg">Be the first on the wall. Snap the crew, the burgers, the late-night line — and send it in.</p>
            <LinkButton href="/gallery/submit" variant="primary" className="mt-5">
              Upload a photo
            </LinkButton>
          </div>
        )}
      </div>

      <section aria-labelledby="ig-h" className="mt-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading id="ig-h" kicker="Síguenos" underline="agave">
            @{settings.instagram}
          </SectionHeading>
          <a
            href={`https://instagram.com/${settings.instagram}`}
            rel="noopener"
            className="font-bold text-link underline decoration-2 underline-offset-4"
          >
            Open Instagram →
          </a>
        </div>
        <div className="mt-8">
          {igUrls.length > 0 ? (
            <InstagramEmbeds urls={igUrls} />
          ) : (
            <a href={`https://instagram.com/${settings.instagram}`} rel="noopener" className="group block no-underline" aria-label={`See @${settings.instagram} on Instagram`}>
              <ul className="grid grid-cols-3 gap-3">
                {(['rosa', 'marigold', 'agave'] as const).map((tone, i) => (
                  <li key={tone} className={`shadow-hard-sm aspect-square overflow-hidden rounded-sm border-[length:var(--line-thin)] border-outline ${['tilt-b', 'tilt-c', 'tilt-a'][i]}`}>
                    <PhotoSlot label={['the crowd', 'the grill', 'the line'][i]!} tone={tone} />
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-center gap-2 font-hand text-lg text-marigold">
                <Arrow className="h-8 w-12 -rotate-12" /> tag us to get on the wall
              </p>
            </a>
          )}
        </div>
        <div className="mt-8">
          <Sticker tone="paper" tilt="b">
            Every photo of a person is posted with their OK
          </Sticker>
        </div>
      </section>
    </div>
  );
}
