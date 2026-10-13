import 'server-only';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { partners } from '@/lib/db/schema';

// Partner referral attribution. /r/[code] (and QR codes pointing at it) set
// this cookie for 24 hours — one night out; orders placed meanwhile are
// credited to that partner.
export const REF_COOKIE = 'bb_ref';
export const REF_MAX_AGE = 60 * 60 * 24;

/** The referring partner's id for the current visitor, if any. */
export async function referralPartnerId(): Promise<string | null> {
  const code = (await cookies()).get(REF_COOKIE)?.value;
  if (!code) return null;
  const [p] = await db
    .select({ id: partners.id })
    .from(partners)
    .where(eq(partners.code, code.toUpperCase()))
    .limit(1);
  return p?.id ?? null;
}
