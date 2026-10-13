import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { partnerVisits, partners } from '@/lib/db/schema';
import { REF_COOKIE, REF_MAX_AGE } from '@/lib/referral';

// Partner referral links and QR codes: /r/HARPERS → count the visit, remember
// the partner for one night (cookie), and land on the order page.
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }): Promise<NextResponse> {
  const { code: raw } = await params;
  const code = raw.trim().toUpperCase();
  const to = req.nextUrl.searchParams.get('to');
  // Only same-site paths ("/menu"), never "//evil.com" or absolute URLs.
  const dest = to && /^\/(?!\/)[\w\-/?=&#.%]*$/.test(to) ? to : '/order';
  const res = NextResponse.redirect(new URL(dest, req.nextUrl.origin), 307);

  if (!/^[A-Z0-9]{3,16}$/.test(code)) return res;
  const [partner] = await db
    .select({ id: partners.id })
    .from(partners)
    .where(and(eq(partners.code, code), eq(partners.active, true)))
    .limit(1);
  if (!partner) return res;

  const ua = req.headers.get('user-agent') ?? '';
  if (!/bot|crawl|spider|preview|facebookexternalhit|slackbot|twitterbot|whatsapp/i.test(ua)) {
    await db.insert(partnerVisits).values({ partnerId: partner.id });
  }
  res.cookies.set(REF_COOKIE, code, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: REF_MAX_AGE,
  });
  return res;
}
