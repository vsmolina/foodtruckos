import { NextResponse } from 'next/server';
import { WebhooksHelper } from 'square';
import { syncBySquareOrderId } from '@/lib/orders/status';
import { syncedWithin, syncMenuFromSquare } from '@/lib/square/sync';

// Square → website. Subscribe (Square Developer Dashboard → Webhooks) to:
//   order.fulfillment.updated, order.updated  → web order status + ready text
//   catalog.version.updated                   → menu sync
// The notification URL must equal SQUARE_WEBHOOK_NOTIFICATION_URL exactly.

type Event = { type?: string; data?: { id?: string; object?: Record<string, { order_id?: string; id?: string } | undefined> } };

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.text();
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const url = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL;
  if (!key || !url) return NextResponse.json({ error: 'webhook not configured' }, { status: 503 });

  const valid = await WebhooksHelper.verifySignature({
    requestBody: body,
    signatureHeader: req.headers.get('x-square-hmacsha256-signature') ?? '',
    signatureKey: key,
    notificationUrl: url,
  });
  if (!valid) return NextResponse.json({ error: 'bad signature' }, { status: 401 });

  let event: Event;
  try {
    event = JSON.parse(body) as Event;
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  try {
    if (event.type === 'order.fulfillment.updated' || event.type === 'order.updated') {
      const obj = event.data?.object ?? {};
      const orderId = obj.order_fulfillment_updated?.order_id ?? obj.order_updated?.order_id ?? event.data?.id;
      if (orderId) await syncBySquareOrderId(orderId);
    } else if (event.type === 'catalog.version.updated') {
      // Square fires one per save; a burst of edits → one sync.
      if (!syncedWithin(20)) await syncMenuFromSquare();
    }
  } catch (err) {
    console.error('[square webhook] handling failed:', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 }); // Square retries
  }
  return NextResponse.json({ ok: true });
}
