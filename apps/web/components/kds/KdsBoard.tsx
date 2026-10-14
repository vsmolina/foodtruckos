'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SOCKET, type KdsTicket } from '@/lib/kds/types';
import { TimerProvider } from './TimerContext';
import { OrderCard } from './OrderCard';
import { RecentPanel } from './RecentPanel';

const ROWS = 2;
const SCALES = [0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6];
const SCALE_KEY = 'kds:text-scale';

// Text size, set per screen (it depends on how far the cook stands). Applied as
// a CSS variable on <html> and kept in this browser only; any storage failure
// just means the default size.
function useTextScale(): (dir: 1 | -1) => void {
  const index = useRef(SCALES.indexOf(1));
  const apply = (): void =>
    document.documentElement.style.setProperty('--kds-scale', String(SCALES[index.current] ?? 1));
  useEffect(() => {
    try {
      const saved = SCALES.indexOf(Number(localStorage.getItem(SCALE_KEY)));
      if (saved >= 0) index.current = saved;
    } catch {}
    apply();
  }, []);
  return (dir) => {
    index.current = Math.min(SCALES.length - 1, Math.max(0, index.current + dir));
    apply();
    try {
      localStorage.setItem(SCALE_KEY, String(SCALES[index.current]));
    } catch {}
  };
}

// 3 columns on a small Pi panel (bigger cards, bigger type), 4 on a wide screen.
function useColumns(): number {
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1180px)');
    const update = (): void => setCols(mq.matches ? 4 : 3);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return cols;
}

export function KdsBoard({ storeId }: { storeId: string }): React.JSX.Element {
  const [tickets, setTickets] = useState<Map<string, KdsTicket>>(new Map());
  const [connected, setConnected] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  // Armed (tapped, counting down) tickets → paused? See the tap handlers below.
  const [armed, setArmed] = useState<Map<string, boolean>>(new Map());
  const [tallIds, setTallIds] = useState<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);
  const cols = useColumns();
  const stepScale = useTextScale();
  const maxCards = cols * ROWS;

  useEffect(() => {
    const socket = io({ transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    const upsert = (t: KdsTicket): void =>
      setTickets((prev) => new Map(prev).set(t.id, t));
    const drop = <V,>(prev: Map<string, V>, id: string): Map<string, V> => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    };
    const remove = (t: { id: string }): void => {
      setTickets((prev) => drop(prev, t.id));
      setArmed((prev) => drop(prev, t.id));
    };

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

  // Fill the board's slots oldest-first; a tall ticket costs a whole column (2).
  // If they don't all fit, keep one slot for the "+N more waiting" tile.
  const { visible, hiddenCount } = useMemo(() => {
    const cost = (t: KdsTicket): number => (tallIds.has(t.id) ? ROWS : 1);
    const total = sorted.reduce((n, t) => n + cost(t), 0);
    const budget = total <= maxCards ? maxCards : maxCards - 1;
    const shown: KdsTicket[] = [];
    let used = 0;
    for (const t of sorted) {
      if (used + cost(t) > budget) break;
      shown.push(t);
      used += cost(t);
    }
    return { visible: shown, hiddenCount: sorted.length - shown.length };
  }, [sorted, tallIds, maxCards]);
  const overflow = hiddenCount > 0;
  const markTall = useCallback(
    (id: string): void => setTallIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id))),
    [],
  );

  // Tap = arm (the card bulges up and counts down 1.5 s, then completes).
  // Several cards can be armed at once; each clears on its own countdown, in
  // the order tapped. A second tap completes at once. Scrolling an armed card
  // pauses its countdown until Cancel or Done. Value = paused.
  const disarm = useCallback(
    (id: string): void =>
      setArmed((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      }),
    [],
  );
  const complete = useCallback(
    (id: string): void => {
      socketRef.current?.emit(SOCKET.complete, { ticketId: id, storeId });
      disarm(id);
    },
    [storeId, disarm],
  );
  const tap = (ticket: KdsTicket): void => {
    const paused = armed.get(ticket.id);
    if (paused === undefined) setArmed((prev) => new Map(prev).set(ticket.id, false));
    else if (!paused) complete(ticket.id);
  };
  const pause = useCallback(
    (id: string): void =>
      setArmed((prev) => (prev.get(id) === false ? new Map(prev).set(id, true) : prev)),
    [],
  );
  const disarmAll = (): void => setArmed((prev) => (prev.size ? new Map() : prev));
  useEffect(() => {
    if (!armed.size) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setArmed(new Map());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [armed]);
  const loadRecent = useCallback(
    (reply: (list: KdsTicket[]) => void): void => {
      socketRef.current?.emit(SOCKET.recent, storeId, reply);
    },
    [storeId],
  );
  const recall = (ticket: KdsTicket): void => {
    socketRef.current?.emit(SOCKET.recall, { ticketId: ticket.id, storeId });
  };

  return (
    <TimerProvider>
    <div
      data-kds
      className="flex h-screen w-screen flex-col overflow-hidden bg-bg"
    >
      <div
        className="grid min-h-0 flex-1 gap-[0.5em] p-[0.5em] pb-0"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
          // Oldest top-left, reading down each column then across; dense packing
          // back-fills the gap a full-height ticket leaves.
          gridAutoFlow: 'column dense',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) disarmAll();
        }}
      >
        {sorted.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center text-ink-3"
            style={{ gridColumn: '1 / -1', gridRow: '1 / -1' }}
          >
            <div className="font-display text-[1.8em] text-ink-2">No active orders</div>
            <div className="mt-2 text-[0.8em]">
              {connected ? 'Waiting for the next order…' : 'Connecting…'}
            </div>
          </div>
        ) : (
          <>
            {visible.map((t) => (
              <OrderCard
                key={t.id}
                ticket={t}
                tall={tallIds.has(t.id)}
                armed={armed.has(t.id)}
                paused={armed.get(t.id) === true}
                onOverflow={markTall}
                onTap={tap}
                onScrolled={pause}
                onCancel={disarm}
                onConfirm={complete}
              />
            ))}
            {overflow ? (
              <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--ink-3)] bg-bg-raised text-ink">
                <div className="font-mono text-[2.4em] font-bold leading-none">+{hiddenCount}</div>
                <div className="mt-1 text-[0.75em] font-semibold uppercase tracking-wide text-ink-2">more waiting</div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Footer: recent orders + connection status (only shown when down) */}
      <div className="flex items-center justify-between px-[0.5em] py-[0.35em]">
        <button
          type="button"
          onClick={() => setShowRecent(true)}
          disabled={!connected}
          className="min-h-[44px] rounded-[var(--radius)] border border-[var(--ink-3)] px-[0.9em] text-[0.7em] font-semibold uppercase tracking-wide text-ink-2 outline-accent focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
        >
          Recent
        </button>
        <div className="ml-auto mr-[0.8em] flex items-center gap-[0.3em] text-[0.7em] text-ink-3">
          <span className="uppercase tracking-wide">Text</span>
          {([-1, 1] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => stepScale(dir)}
              aria-label={dir < 0 ? 'Smaller text' : 'Larger text'}
              className="min-h-[44px] min-w-[44px] rounded-[var(--radius)] border border-[var(--ink-3)] font-bold text-ink-2 outline-accent focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {dir < 0 ? 'A−' : 'A+'}
            </button>
          ))}
        </div>
        {!connected ? (
          <span className="text-[0.7em] font-bold uppercase tracking-wide" style={{ color: 'var(--kds-no)' }}>Offline</span>
        ) : null}
      </div>

      {showRecent ? (
        <RecentPanel loadRecent={loadRecent} onRecall={recall} onClose={() => setShowRecent(false)} />
      ) : null}
    </div>
    </TimerProvider>
  );
}
