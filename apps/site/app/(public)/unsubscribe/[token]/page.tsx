import type { Metadata } from 'next';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { Button } from '@/components/ui/Button';
import { db } from '@/lib/db/client';
import { subscribers } from '@/lib/db/schema';
import { unsubscribeEmail } from '@/lib/subscribers';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Unsubscribe', robots: { index: false } };

function mask(email: string): string {
  const [user = '', domain = ''] = email.split('@');
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;
  const [sub] = /^[A-Za-z0-9_-]{10,64}$/.test(token)
    ? await db.select().from(subscribers).where(eq(subscribers.unsubscribeToken, token))
    : [];

  async function confirm(): Promise<void> {
    'use server';
    await unsubscribeEmail(token);
    redirect(`/unsubscribe/${token}?done=1`);
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 pt-12">
      {!sub ? (
        <div className="paper p-6">
          <h1 className="font-display text-h3 uppercase">Link not found</h1>
          <p className="mt-2">This unsubscribe link isn’t valid. If you keep getting emails, reply to one and we’ll take you off by hand.</p>
        </div>
      ) : done || sub.emailUnsubscribedAt ? (
        <div className="paper tilt-c p-6" role="status">
          <p className="font-hand text-xl text-[#b3261e]">¡Ni modo!</p>
          <h1 className="font-display text-h3 uppercase">You’re unsubscribed</h1>
          <p className="mt-2">
            No more marketing email to {sub.email ? mask(sub.email) : 'you'}.
            {sub.phone && sub.smsOptIn && !sub.smsStoppedAt ? ' Texts are separate — reply STOP to any text to stop those.' : ''}
          </p>
          <p className="mt-4">
            Changed your mind?{' '}
            <Link href="/specials" className="font-bold underline">
              Sign up again
            </Link>
            .
          </p>
        </div>
      ) : (
        <form action={confirm} className="paper flex flex-col gap-4 p-6">
          <h1 className="font-display text-h3 uppercase">Unsubscribe from emails?</h1>
          <p>
            Stop specials and news emails to <strong>{sub.email ? mask(sub.email) : 'this address'}</strong>.
          </p>
          <Button type="submit" className="self-start">
            Unsubscribe
          </Button>
        </form>
      )}
    </div>
  );
}
