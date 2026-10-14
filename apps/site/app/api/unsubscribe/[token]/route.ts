import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { unsubscribeEmail } from '@/lib/subscribers';

// RFC 8058 one-click unsubscribe: mail apps POST "List-Unsubscribe=One-Click".
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }): Promise<NextResponse> {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) return new NextResponse('Not found', { status: 404 });
  await unsubscribeEmail(token);
  return new NextResponse('Unsubscribed', { status: 200 });
}

// A person opening the header link in a browser gets the confirmation page.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }): Promise<NextResponse> {
  const { token } = await params;
  return NextResponse.redirect(`${env.siteUrl}/unsubscribe/${encodeURIComponent(token)}`, 303);
}
