'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KdsTicket, KdsTicketItem } from '@/lib/kds/types';
import { tierFor, type Tier } from '@/lib/kds/tiers';
import { classifyModifier, isAllergyNote, type ClassifiedMod } from '@/lib/kds/modifiers';
import { useNow } from './TimerContext';
import { TimerDisplay } from './TimerDisplay';

const NEW_MS = 30 * 1000;
/** Tapped once → confirms by itself after this long (a second tap is instant). */
export const CONFIRM_MS = 1500;


export function placedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  });
}

// Header fill per tier: the biggest colour area on the card, so lateness reads
// from across the truck. "LATE" spells it out for colour-blind cooks.
const HEADER: Record<Tier, React.CSSProperties> = {
  normal: { background: 'var(--bg-raised)', color: 'var(--ink)', borderBottom: '1px solid var(--rule)' },
  amber: { background: 'var(--kds-amber)', color: 'var(--kds-amber-ink)' },
  danger: {
    background: 'var(--kds-red)',
    color: 'var(--kds-red-ink)',
    // Pulse 3× at the moment it turns late, then hold: motion *onset* grabs
    // attention, constant motion fades into the background (and floods the board).
    animation: 'kds-alarm 1.6s ease-in-out 3',
  },
};

export function OrderCard({
  ticket,
  tall,
  armed,
  paused,
  onOverflow,
  onTap,
  onScrolled,
  onCancel,
  onConfirm,
}: {
  ticket: KdsTicket;
  /** Spans both board rows (set by the board once this card overflowed). */
  tall: boolean;
  /** Tapped once: bulged up, auto-confirming unless paused. */
  armed: boolean;
  /** The cook scrolled an armed card: auto-confirm is off until Cancel or Done. */
  paused: boolean;
  onOverflow: (id: string) => void;
  onTap: (ticket: KdsTicket) => void;
  onScrolled: (id: string) => void;
  onCancel: (id: string) => void;
  onConfirm: (id: string) => void;
}): React.JSX.Element {
  const now = useNow();

  // Own countdown, so several tapped cards each clear in turn.
  const confirmRef = useRef(onConfirm);
  useEffect(() => {
    confirmRef.current = onConfirm;
  }, [onConfirm]);
  useEffect(() => {
    if (!armed || paused) return;
    const t = setTimeout(() => confirmRef.current(ticket.id), CONFIRM_MS);
    return () => clearTimeout(t);
  }, [armed, paused, ticket.id]);

  // Any scroll on an armed card — a drag, a wheel, or a real scroll on a long
  // list — pauses its countdown, even when the order is short enough to fit.
  const dragFrom = useRef<number | null>(null);
  const scrolling = armed && !paused ? (): void => onScrolled(ticket.id) : undefined;
  // Never silently cut items off. Too long → take a full-height column; still
  // too long → the list scrolls once the card is tapped (with a "more" hint).
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const tallRef = useRef(tall);
  const armedRef = useRef(armed);
  // Layout effect: these must be current before the ResizeObserver fires.
  useLayoutEffect(() => {
    tallRef.current = tall;
    armedRef.current = armed;
  }, [tall, armed]);
  useEffect(() => {
    const box = boxRef.current;
    const content = contentRef.current;
    if (!box || !content) return;
    const check = (): void => {
      const over = box.scrollHeight > box.clientHeight + 1;
      // Never resize a card while it's armed: the Cancel / Done bar would
      // otherwise make it "overflow", grow, and jump (or drop off the board).
      if (over && !tallRef.current && !armedRef.current) onOverflow(ticket.id);
      else setOverflowing(over);
    };
    const ro = new ResizeObserver(check);
    ro.observe(box);
    ro.observe(content);
    return () => ro.disconnect();
  }, [onOverflow, ticket.id]);

  // Flags show whole or not at all — never a sliver beside the timer.
  const flagsRef = useRef<HTMLSpanElement>(null);
  const [flagsFit, setFlagsFit] = useState(true);
  useEffect(() => {
    const el = flagsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFlagsFit(el.scrollWidth <= el.clientWidth + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Back to the top whenever the card is put back.
  useEffect(() => {
    if (!armed) boxRef.current?.scrollTo({ top: 0 });
  }, [armed]);

  const elapsed = now - new Date(ticket.startedAt).getTime();
  const tier = tierFor(elapsed);
  const isNew = now - new Date(ticket.placedAt).getTime() < NEW_MS && !ticket.recalled;

  const allergyNotes = ticket.items.flatMap((it) => (it.notes && isAllergyNote(it.notes) ? [it.notes] : []));
  const special = ticket.items.some((it) => it.modifiers.length > 0 || it.notes);

  const border =
    tier === 'danger'
      ? '3px solid var(--kds-red)'
      : tier === 'amber'
        ? '3px solid var(--kds-amber)'
        : allergyNotes.length
          ? '3px solid var(--kds-red)'
          : '1px solid var(--rule)';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onTap(ticket)}
      onPointerDown={(e) => {
        dragFrom.current = e.clientY;
      }}
      onPointerMove={(e) => {
        if (scrolling && dragFrom.current !== null && Math.abs(e.clientY - dragFrom.current) > 10) scrolling();
      }}
      onPointerUp={() => {
        dragFrom.current = null;
      }}
      onPointerCancel={() => {
        // The browser took the gesture over as a pan → the cook is scrolling.
        if (dragFrom.current !== null) scrolling?.();
        dragFrom.current = null;
      }}
      onWheel={scrolling}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTap(ticket);
        }
      }}
      className="relative flex h-full min-h-0 w-full cursor-pointer select-none flex-col overflow-hidden rounded-[var(--radius-lg)] bg-bg-raised text-left outline-accent focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        border,
        animation: 'kds-enter var(--dur-4) var(--ease-spring)',
        gridRow: tall ? 'span 2' : undefined,
        touchAction: 'manipulation',
        // Bulge: lift the tapped card above its neighbours.
        // (A full-height card bulges less so it stays on screen.)
        transform: armed ? (tall ? 'scale(1.025)' : 'scale(1.05) translateY(-0.25em)') : undefined,
        transition: 'transform 180ms var(--ease-spring), box-shadow 180ms ease-out',
        zIndex: armed ? 20 : undefined,
        boxShadow: armed
          ? '0 0 0 3px var(--ink), 0 1.4em 2.8em -0.6em rgba(20,17,14,0.45)'
          : 'var(--kds-card-shadow)',
      }}
      aria-label={`Order ${ticket.number}, tap to complete`}
      aria-pressed={armed}
    >
      {/* Header: order number, flags, live timer */}
      <div className="flex items-center gap-2 px-[0.6em] py-[0.35em]" style={HEADER[tier]}>
        <span className="shrink-0 font-mono text-[1.3em] font-bold leading-none tracking-tight">{ticket.number}</span>
        {/* Flags give way (clip) before the timer ever moves */}
        {/* One line high: a flag that doesn't fit wraps out of sight, never half-shown */}
        <span
          ref={flagsRef}
          className="flex h-[1.06em] min-w-0 flex-1 flex-wrap gap-1 overflow-hidden"
          style={{ visibility: flagsFit ? undefined : 'hidden' }}
        >
          {isNew ? <Flag bg="var(--ink)" fg="var(--bg)">New</Flag> : null}
          {ticket.recalled ? <Flag bg="var(--kds-add)" fg="var(--kds-add-ink)">Recalled</Flag> : null}
          {special && !allergyNotes.length ? (
            <Flag bg="var(--kds-note)" fg="var(--kds-note-ink)">Special</Flag>
          ) : null}
        </span>
        <span className="flex shrink-0 items-baseline gap-2 leading-none">
          {tier === 'danger' ? <span className="text-[0.75em] font-bold uppercase tracking-wider">Late</span> : null}
          <span className="text-[1.45em]">
            <TimerDisplay startedAt={ticket.startedAt} />
          </span>
        </span>
      </div>

      {/* Auto-confirm countdown: drains over 1.5 s while armed */}
      {armed && !paused ? (
        <div className="h-[0.3em] w-full bg-bg">
          <div
            className="h-full"
            style={{ background: 'var(--ink)', animation: `kds-countdown ${CONFIRM_MS}ms linear forwards` }}
          />
        </div>
      ) : null}

      {/* Allergy banner: the loudest thing on the board, above the items */}
      {allergyNotes.length ? (
        <div
          className="px-[0.6em] py-[0.3em] font-bold uppercase leading-tight"
          style={{ background: 'var(--kds-red)', color: 'var(--kds-red-ink)' }}
        >
          ⚠ {allergyNotes.map((n) => (/allerg/i.test(n) ? n : `Allergy: ${n}`)).join(' · ')}
        </div>
      ) : null}

      {/* Items — scrollable only once the card is tapped */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={boxRef}
          onScroll={scrolling}
          className="h-full px-[0.6em] py-[0.4em]"
          style={{
            overflowX: 'hidden',
            overflowY: armed ? 'auto' : 'hidden',
            overscrollBehavior: 'contain',
            // Long list: native scrolling. Short list: we see the drag ourselves.
            touchAction: armed ? (overflowing ? 'pan-y' : 'none') : 'manipulation',
          }}
        >
          <div ref={contentRef} className="[overflow-wrap:break-word]">
            {ticket.items.map((it, i) => (
              <Item key={i} item={it} />
            ))}
          </div>
        </div>
        {overflowing && !paused ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center pb-[0.3em] pt-[1.6em]"
            style={{ background: 'linear-gradient(to bottom, transparent, var(--bg-raised) 55%)' }}
          >
            <span
              className="rounded-full px-[0.7em] text-[0.7em] font-extrabold uppercase leading-[1.8] tracking-wider"
              style={{ background: 'var(--kds-note)', color: 'var(--kds-note-ink)' }}
            >
              {armed ? '▼ Scroll' : '▼ More · tap'}
            </span>
          </div>
        ) : null}
      </div>

      {/* Footer: when it came in — or, while armed, Cancel / Done */}
      {armed ? (
        <div className="flex gap-[0.4em] border-t border-[var(--rule)] p-[0.4em]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancel(ticket.id);
            }}
            className="min-h-[48px] flex-1 rounded-[var(--radius)] border-2 border-[var(--ink-2)] text-[0.85em] font-bold uppercase tracking-wide text-ink outline-accent focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm(ticket.id);
            }}
            className="min-h-[48px] flex-[2] rounded-[var(--radius)] text-[0.85em] font-extrabold uppercase tracking-wide outline-accent focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
          >
            ✓ Done
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between border-t border-[var(--rule)] px-[0.6em] py-[0.25em] text-[0.7em] uppercase tracking-wide text-ink-3">
          <span>In at</span>
          <span className="font-mono text-ink-2">{placedTime(ticket.placedAt)}</span>
        </div>
      )}
    </div>
  );
}

function Item({ item }: { item: KdsTicketItem }): React.JSX.Element {
  const allergy = item.notes !== null && isAllergyNote(item.notes);
  const showNote = item.notes && !allergy;
  return (
    <div className="mb-[0.45em] last:mb-0">
      <div className="flex items-baseline gap-[0.4em] font-semibold leading-tight text-ink">
        <span className="min-w-[1.6em] font-mono font-bold">{item.qty}×</span>
        <span className="min-w-0">{item.name}</span>
      </div>
      {item.modifiers.length || item.notes ? (
        <div className="mt-[0.2em] flex flex-col gap-[0.2em] pl-[2em]">
          {allergy ? (
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-[0.4em] font-bold leading-tight" style={{ color: 'var(--kds-no)' }}>
              <Tag bg="var(--kds-red)" fg="var(--kds-red-ink)">⚠ Allergy</Tag>
              <span className="min-w-0 uppercase">{item.notes}</span>
            </div>
          ) : null}
          {item.modifiers.map((m, j) => (
            <Mod key={j} mod={classifyModifier(m)} />
          ))}
          {showNote ? (
            <div
              className="rounded-[var(--radius)] px-[0.4em] py-[0.1em] text-[0.95em] font-semibold leading-snug"
              style={{ background: 'var(--kds-note)', color: 'var(--kds-note-ink)' }}
            >
              “{item.notes}”
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// Modifier line: a word tag (NO / ADD / EXTRA) + bold text, so a removal can't
// be skimmed as an ingredient. Removals are the costliest miss, so they're loudest.
function Mod({ mod }: { mod: ClassifiedMod }): React.JSX.Element {
  if (mod.kind === 'remove') {
    return (
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-[0.4em] font-bold leading-tight" style={{ color: 'var(--kds-no)' }}>
        <Tag bg="var(--kds-red)" fg="var(--kds-red-ink)">{mod.label}</Tag>
        <span className="min-w-0 uppercase">{mod.text}</span>
      </div>
    );
  }
  if (mod.kind === 'add' || mod.kind === 'extra') {
    return (
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-[0.4em] font-bold leading-tight" style={{ color: 'var(--kds-add)' }}>
        <Tag bg="var(--kds-add)" fg="var(--kds-add-ink)">{mod.label}</Tag>
        <span className="min-w-0">{mod.text}</span>
      </div>
    );
  }
  return (
    <div className="flex items-baseline gap-[0.4em] font-bold leading-tight text-ink">
      <span className="text-ink-3">•</span>
      <span className="min-w-0">{mod.text}</span>
    </div>
  );
}

function Tag({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <span
      className="shrink-0 rounded-[3px] px-[0.3em] text-[0.72em] font-extrabold uppercase tracking-wider"
      style={{ background: bg, color: fg, lineHeight: 1.5 }}
    >
      {children}
    </span>
  );
}

function Flag({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <span
      className="shrink-0 rounded-full px-[0.5em] text-[0.62em] font-extrabold uppercase leading-[1.7] tracking-wider"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}
