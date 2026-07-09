import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { webhookEvents } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { ingestOrderById, ingestPayment, upsertOrder, type RawPayment } from '@/lib/square/ingest';
import { retrieveOrder } from '@/lib/square/client';
import { SIGNATURE_HEADER, verifySignature } from '@/lib/square/webhook';

export const dynamic = 'force-dynamic';

// --- Minimal shapes of the Square webhook envelope we depend on -------------
type ThinOrder = { order_id?: string; location_id?: string; version?: number; state?: string };
type SquareEvent = {
  event_id?: string;
  type?: string;
  data?: {
    object?: {
      order_created?: ThinOrder;
      order_updated?: ThinOrder;
      order_fulfillment_updated?: ThinOrder;
      payment?: RawPayment;
    };
  };
};

/** Dispatch a verified event. Throws on failure so the caller can 500 + let Square retry. */
async function dispatch(event: SquareEvent): Promise<void> {
  const obj = event.data?.object ?? {};
  switch (event.type) {
    case 'order.created': {
      const id = obj.order_created?.order_id;
      if (id) await ingestOrderById(id);
      return;
    }
    case 'order.updated': {
      const id = obj.order_updated?.order_id;
      if (id) await upsertOrder(await retrieveOrder(id));
      return;
    }
    case 'order.fulfillment.updated': {
      // Re-hydrate to mirror state; the cook still owns "done" on the KDS.
      const id = obj.order_fulfillment_updated?.order_id;
      if (id) await upsertOrder(await retrieveOrder(id));
      return;
    }
    case 'payment.created':
    case 'payment.updated': {
      if (obj.payment) await ingestPayment(obj.payment);
      return;
    }
    default:
      logger.info({ type: event.type }, 'unhandled square event type');
  }
}

export async function POST(req: Request): Promise<Response> {
  const raw = await req.text();

  let event: SquareEvent;
  try {
    event = JSON.parse(raw) as SquareEvent;
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const eventId = event.event_id;
  const eventType = event.type;
  if (!eventId || !eventType) return new Response('missing event id/type', { status: 400 });

  // Idempotency: if we've already fully processed this event, ack immediately.
  const existing = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.externalId, eventId))
    .limit(1);
  if (existing[0]?.processedAt) {
    return Response.json({ ok: true, duplicate: true });
  }

  // Verify signature over the RAW body.
  const valid = await verifySignature({
    requestBody: raw,
    signatureHeader: req.headers.get(SIGNATURE_HEADER),
    notificationUrl: process.env.SQUARE_WEBHOOK_NOTIFICATION_URL ?? '',
    signatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? '',
  });

  // Record (or refresh) the event row before processing.
  const row = {
    source: 'square',
    externalId: eventId,
    eventType,
    payload: event as unknown,
    signatureValid: valid,
  };
  await db
    .insert(webhookEvents)
    .values(row)
    .onConflictDoUpdate({ target: webhookEvents.externalId, set: row });

  if (!valid) {
    logger.warn({ eventId, eventType }, 'square webhook signature invalid');
    return new Response('invalid signature', { status: 401 });
  }

  try {
    await dispatch(event);
    await db
      .update(webhookEvents)
      .set({ processedAt: new Date(), error: null })
      .where(eq(webhookEvents.externalId, eventId));
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ eventId, eventType, err: message }, 'square webhook processing failed');
    await db
      .update(webhookEvents)
      .set({ error: message })
      .where(eq(webhookEvents.externalId, eventId));
    // 500 → Square retries with backoff.
    return new Response('processing error', { status: 500 });
  }
}
