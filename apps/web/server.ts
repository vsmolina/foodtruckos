import { createServer } from 'node:http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { kitchenTickets } from '@/lib/db/schema';
import { subscribe } from '@/lib/realtime/channel';
import { getActiveTickets } from '@/lib/kds/snapshot';
import { SOCKET, type KdsEvent } from '@/lib/kds/types';
import { logger } from '@/lib/logger';

/**
 * Custom server: Next.js request handler + Socket.IO on one HTTP server.
 * Socket.IO intercepts its own `/socket.io/` path; everything else falls
 * through to Next. Redis `kds:store:*` events are fanned out to per-store
 * rooms so the KDS updates in real time (see docs Phase 2/3).
 */
const port = parseInt(process.env.PORT ?? '3000', 10);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const roomFor = (storeId: string): string => `store:${storeId}`;

app.prepare().then(async () => {
  const httpServer = createServer((req, res) => handle(req, res));
  const io = new SocketIOServer(httpServer, {
    // Same-origin in the browser; the Pi kiosk hits the LAN IP directly.
    cors: { origin: '*' },
  });

  // Bridge: Redis pub/sub (written by the webhook ingest) → socket rooms.
  await subscribe('kds:store:*', (payload, channel) => {
    const storeId = channel.slice('kds:store:'.length);
    const event = payload as KdsEvent;
    if (!event?.type || !event.ticket) return;
    io.to(roomFor(storeId)).emit(event.type, event.ticket);
    logger.debug({ storeId, type: event.type }, 'kds event fanned out');
  });

  io.on('connection', (socket) => {
    // A KDS client asks to watch one store; reply with the current snapshot so
    // a server/client restart never loses in-flight orders.
    socket.on(SOCKET.join, async (storeId: unknown) => {
      if (typeof storeId !== 'string' || storeId.length === 0) return;
      await socket.join(roomFor(storeId));
      try {
        socket.emit(SOCKET.snapshot, await getActiveTickets(storeId));
      } catch (err) {
        logger.error({ err: err instanceof Error ? err.message : String(err), storeId }, 'kds snapshot failed');
      }
    });

    // Cook tapped "done": mark the ticket complete and remove it everywhere.
    socket.on(SOCKET.complete, async (payload: unknown) => {
      const { ticketId, storeId } = (payload ?? {}) as { ticketId?: string; storeId?: string };
      if (!ticketId || !storeId) return;
      try {
        const [row] = await db
          .update(kitchenTickets)
          .set({ state: 'done', completedAt: new Date() })
          .where(eq(kitchenTickets.id, ticketId))
          .returning();
        if (row) io.to(roomFor(storeId)).emit(SOCKET.removed, { id: row.id, orderId: row.orderId });
      } catch (err) {
        logger.error({ err: err instanceof Error ? err.message : String(err), ticketId }, 'kds complete failed');
      }
    });
  });

  httpServer.listen(port, () => logger.info({ port, dev }, 'server (next + socket.io) listening'));
});
