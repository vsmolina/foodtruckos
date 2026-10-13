import type { ReactNode } from 'react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Sticker } from '@/components/ui/Sticker';

/** Long-form legal text: plain English, readable measure, draft banner. */
export function LegalPage({ title, kicker, updated, children }: { title: string; kicker: string; updated: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10">
      <SectionHeading as="h1" size="h1" kicker={kicker} underline="marigold">
        {title}
      </SectionHeading>
      <div className="mt-8 flex flex-wrap items-center gap-3 rounded-sm border-[length:var(--line-thin)] border-outline bg-marigold p-3 text-on-marigold" role="note">
        <Sticker tone="paper" tilt="a" size="sm">
          Draft
        </Sticker>
        <p className="font-bold">Placeholder text — have a lawyer review before launch.</p>
      </div>
      <p className="mt-4 text-sm text-ink-muted">Last updated {updated}</p>
      <div className="legal mt-6 flex flex-col gap-4 text-base leading-relaxed [&_a]:font-bold [&_a]:text-link [&_a]:underline [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-h3 [&_h2]:uppercase [&_h3]:mt-2 [&_h3]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </div>
    </div>
  );
}
