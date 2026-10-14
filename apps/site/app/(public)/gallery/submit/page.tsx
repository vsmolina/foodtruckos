import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { SubmitForm } from './SubmitForm';

export const metadata: Metadata = { title: 'Get featured', description: 'Send us your photo from a night on the Square.' };

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-10">
      <Link href="/gallery" className="text-sm font-bold underline">
        ← Gallery
      </Link>
      <SectionHeading as="h1" size="h1" kicker="¡Sal en la pared!" underline="marigold" className="mt-4">
        Get featured
      </SectionHeading>
      <p className="mt-6 text-lg text-ink-muted">
        Send a photo from a night at the truck. We review every one, and we only post people who agreed to be in it.
      </p>
      <div className="mt-8">
        <SubmitForm />
      </div>
    </div>
  );
}
