import type { Metadata } from 'next';
import { SpecialCard } from '@/components/home/SpecialCard';
import { Arrow } from '@/components/ui/Doodles';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { getActiveSpecials } from '@/lib/menu';
import { EMAIL_CONSENT, SMS_CONSENT } from '@/lib/subscribers';
import { SignupForm } from './SignupForm';

export const metadata: Metadata = {
  title: 'Specials & updates',
  description: 'Get Barrio Burger Co. specials, new items and the nights we’re out on the Square by text or email.',
};

export default async function SpecialsPage() {
  const specials = await getActiveSpecials();
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <div className="flex flex-col gap-4">
          <SectionHeading as="h1" size="h1" kicker="¡No te lo pierdas!" underline="rosa">
            Get the specials
          </SectionHeading>
          <p className="mt-4 max-w-xl text-lg">
            New items, two-for-one nights, and a heads-up the night we’re back on the Square. By text, email, or both — up to about 4 a month.
          </p>
          <div aria-hidden className="hidden items-center gap-2 text-marigold lg:flex">
            <span className="font-hand text-xl tilt-a">sólo lo bueno, sin spam</span>
            <Arrow className="draw h-14 w-20" />
          </div>
        </div>
        <SignupForm emailConsent={EMAIL_CONSENT} smsConsent={SMS_CONSENT} />
      </div>

      {specials.length > 0 ? (
        <section className="mt-16" aria-labelledby="now-h">
          <SectionHeading id="now-h" kicker="Ahorita" underline="agave">
            On now
          </SectionHeading>
          <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {specials.map((s, i) => (
              <SpecialCard key={s.id} special={s} index={i} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
