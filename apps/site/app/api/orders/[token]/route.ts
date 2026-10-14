import { NextResponse } from 'next/server';
import { publicOrderByToken } from '@/lib/orders/public';

// Polled by the order status page every few seconds.
export async function GET(_req: Request, ctx: RouteContext<'/api/orders/[token]'>): Promise<NextResponse> {
  const { token } = await ctx.params;
  const order = await publicOrderByToken(token);
  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(order, { headers: { 'Cache-Control': 'no-store' } });
}
