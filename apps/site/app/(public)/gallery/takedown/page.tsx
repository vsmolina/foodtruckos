import type { Metadata } from 'next';
import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { db } from '@/lib/db/client';
import { galleryPhotos } from '@/lib/db/schema';
import { TakedownForm } from './TakedownForm';

export const metadata: Metadata = { title: 'Request a photo be taken down', robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TakedownPage({ searchParams }: { searchParams: Promise<{ photo?: string }> }) {
  const { photo } = await searchParams;
  let found: { id: string; url: string } | undefined;
  if (photo && UUID.test(photo)) {
    [found] = await db
      .select({ id: galleryPhotos.id, url: galleryPhotos.url })
      .from(galleryPhotos)
      .where(and(eq(galleryPhotos.id, photo), eq(galleryPhotos.status, 'approved')))
      .limit(1);
  }
  return (
    <div className="mx-auto max-w-2xl px-4 pt-10">
      <Link href="/gallery" className="text-sm font-bold underline">
        ← Gallery
      </Link>
      <SectionHeading as="h1" size="h2" underline="chile" className="mt-4">
        Take a photo down
      </SectionHeading>
      <p className="mt-6 text-lg text-ink-muted">
        In a photo you don’t want online? Tell us and we’ll remove it — no questions needed.
      </p>
      <div className="mt-8">
        <TakedownForm photoId={found?.id ?? null} photoUrl={found?.url ?? null} />
      </div>
    </div>
  );
}
