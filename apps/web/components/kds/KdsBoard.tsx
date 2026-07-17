'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SOCKET, type KdsTicket } from '@/lib/kds/types';
import { TimerProvider } from './TimerContext';
import { OrderCard } from './OrderCard';
import { CompleteConfirmModal } from './CompleteConfirmModal';

const MAX_CARDS = 8;

export function KdsBoard({ storeId }: { storeId: string }): React.JSX.Element {
  const [tickets, setTickets] = useState<Map<string, KdsTicket>>(new Map());
  const [connected, setConnected] = useState(false);
  const [selected, setSelected] = useState<KdsTicket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io({ transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    const upsert = (t: KdsTicket): void =>
      setTickets((prev) => new Map(prev).set(t.id, t));
    const remove = (t: { id: string }): void =>
      setTickets((prev) => {
        const next = new Map(prev);
        next.delete(t.id);
        return next;
      });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit(SOCKET.join, storeId);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on(SOCKET.snapshot, (list: KdsTicket[]) =>
      setTickets(new Map(list.map((t) => [t.id, t]))),
    );
    socket.on(SOCKET.created, upsert);
    socket.on(SOCKET.updated, upsert);
    socket.on(SOCKET.removed, remove);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [storeId]);

  const sorted = useMemo(
    () =>
      [...tickets.values()].sort(
        (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
      ),
    [tickets],
  );

  const overflow = sorted.length > MAX_CARDS;
  const visible = overflow ? sorted.slice(0, MAX_CARDS - 1) : sorted;
  const hiddenCount = overflow ? sorted.length - (MAX_CARDS - 1) : 0;

  const complete = (ticket: KdsTicket): void => {
    socketRef.current?.emit(SOCKET.complete, { ticketId: ticket.id, storeId });
    setSelected(null);
  };

  return (
    <TimerProvider>
    <div
      data-theme="dark"
      className="grid h-screen w-screen grid-cols-4 grid-rows-2 gap-3 overflow-hidden bg-bg p-3"
    >
      {sorted.length === 0 ? (
        <div className="col-span-4 row-span-2 flex flex-col items-center justify-center text-ink-3">
          <div className="font-display text-3xl text-ink-2">No active orders</div>
          <div className="mt-2 text-sm">
            {connected ? 'Waiting for the next order…' : 'Connecting…'}
          </div>
        </div>
      ) : (
        <>
          {visible.map((t) => (
            <OrderCard key={t.id} ticket={t} onComplete={setSelected} />
          ))}
          {overflow ? (
            <div className="flex flex-col items-center justify-center rounded-[var(--radius)] border border-[var(--rule)] bg-bg-raised text-ink-2">
              <div className="font-mono text-3xl font-semibold">+{hiddenCount}</div>
              <div className="text-[12px] uppercase tracking-wide text-ink-3">more waiting</div>
            </div>
          ) : null}
        </>
      )}

      {/* Connection dot — unobtrusive, only meaningful when down */}
      {!connected ? (
        <div className="pointer-events-none fixed bottom-2 right-3 text-[11px] uppercase tracking-wide text-danger">
          offline
        </div>
      ) : null}

      {selected ? (
        <CompleteConfirmModal
          ticket={selected}
          onConfirm={() => complete(selected)}
          onCancel={() => setSelected(null)}
        />
      ) : null}
    </div>
    </TimerProvider>
  );
}
