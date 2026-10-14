import type { Metadata } from 'next';
import Image from 'next/image';
import { asc, eq } from 'drizzle-orm';
import { LinkButton } from '@/components/ui/Button';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { PhotoSlot } from '@/components/ui/Slots';
import { Sticker } from '@/components/ui/Sticker';
import { cx } from '@/lib/cx';
import { db } from '@/lib/db/client';
import { partners } from '@/lib/db/schema';

export const metadata: Metadata = {
  title: 'Partners',
  description: 'The bars and bartenders on the Square in San Marcos who send people our way. Order ahead from your table.',
};

// Fixed cycles by position: tilt, photo-slot tone, sticker tilt.
const TILTS = ['tilt-c', 'tilt-b', 'tilt-a'] as const;
const TONES = ['rosa', 'agave', 'marigold'] as const;
const KIND = { bar: { label: 'Bar', es: 'Cantina', tone: 'marigold' }, bartender: { label: 'Bartender', es: 'Cantinero', tone: 'rosa' }, other: { label: 'Friend', es: 'Compa', tone: 'agave' } } as const;

export default async function PartnersPage() {
  const rows = await db.select().from(partners).where(eq(partners.active, true)).orderBy(asc(partners.sortOrder), asc(partners.name));
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10">
      <SectionHeading as="h1" size="h1" kicker="Nuestros compas" underline="agave">
        Partners
      </SectionHeading>
      <p className="mt-6 max-w-2xl text-lg text-ink-muted">
        The bars and bartenders on the Square who keep the night going — and send everyone our way after last call. Order from their link and
        your food’s ready when you walk over.
      </p>

      {rows.length === 0 ? (
        <p className="mt-10 text-lg">Partners coming soon.</p>
      ) : (
        <ul className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p, i) => {
            const kind = KIND[p.kind];
            return (
              <li key={p.id} className={cx('panel relative flex flex-col overflow-hidden', TILTS[i % 3])}>
                <div className="relative aspect-[16/10] border-b-[length:var(--line)] border-outline">
                  {p.photoUrl ? (
                    <Image src={p.photoUrl} alt={p.name} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
                  ) : (
                    <PhotoSlot label={p.name} tone={TONES[i % 3] ?? 'rosa'} />
                  )}
                </div>
                <Sticker tone={kind.tone} tilt={i % 2 ? 'b' : 'e'} size="sm" className="absolute left-3 top-3">
                  {kind.label} · {kind.es}
                </Sticker>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <h2 className="font-display text-h3 uppercase">{p.name}</h2>
                  {p.blurb ? <p className="text-ink-muted">{p.blurb}</p> : null}
                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
                    <LinkButton href={`/r/${p.code}`} prefetch={false} variant="marigold" size="sm">
                      Order from {p.kind === 'bartender' ? 'the bar' : p.name}
                    </LinkButton>
                    {p.instagram ? (
                      <a href={`https://instagram.com/${p.instagram}`} rel="noopener" className="min-h-11 content-center text-sm font-bold underline decoration-2 underline-offset-4">
                        @{p.instagram}
                      </a>
                    ) : null}
                    {p.url ? (
                      <a href={p.url} rel="noopener" className="min-h-11 content-center text-sm font-bold underline decoration-2 underline-offset-4">
                        Website
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section className="paper tilt-b mt-16 flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-hand text-xl text-[#b3261e]">¿Tienes un bar?</p>
          <h2 className="font-display text-h3 uppercase">Work with us</h2>
          <p className="mt-1 text-lg">Bar or bartender on the Square? We’ll set you up with your own QR code for the table tents.</p>
        </div>
        <LinkButton href="/catering" variant="primary" className="shrink-0">
          Get in touch
        </LinkButton>
      </section>
    </div>
  );
}
