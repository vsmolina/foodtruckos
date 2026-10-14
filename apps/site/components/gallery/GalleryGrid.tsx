'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cx } from '@/lib/cx';
import type { PublicPhoto } from '@/lib/gallery/queries';

// Polaroid tiles in CSS columns (masonry without JS). Tilt and tape follow a
// fixed 5-step cycle by position — repeatable, never random.
const TILTS = ['tilt-a', 'tilt-b', 'tilt-c', 'tilt-d', 'tilt-e'] as const;

export function GalleryGrid({ photos }: { photos: PublicPhoto[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const triggers = useRef<Array<HTMLButtonElement | null>>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);
  const lastOpened = useRef<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (d: number) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length)),
    [photos.length],
  );

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open !== null) {
      lastOpened.current = open;
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [open]);

  const onDialogClose = () => {
    setOpen(null);
    // Return focus to the tile that opened the lightbox.
    const i = lastOpened.current;
    if (i !== null) triggers.current[i]?.focus();
  };

  const current = open !== null ? photos[open] : undefined;

  return (
    <>
      <ul className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>li]:mb-6">
        {photos.map((p, i) => (
          <li key={p.id} className="break-inside-avoid">
            <button
              ref={(el) => {
                triggers.current[i] = el;
              }}
              type="button"
              onClick={() => setOpen(i)}
              className={cx(
                'straighten shadow-hard block w-full rounded-sm border-[length:var(--line)] border-outline bg-paper p-2 pb-3 text-left text-paper-ink',
                i % 3 === 0 && 'taped',
                TILTS[i % TILTS.length],
              )}
              aria-label={`Open photo${p.caption ? `: ${p.caption}` : ''}`}
            >
              <span className="relative block overflow-hidden border-2 border-outline bg-surface-2" style={{ aspectRatio: aspect(p) }}>
                <Image src={p.url} alt={p.caption ?? 'A night on the Square'} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" className="object-cover" />
              </span>
              {p.caption || p.credit ? (
                <span className="mt-2 block font-hand text-sm leading-tight">
                  {p.caption}
                  {p.credit ? <span className="block text-xs opacity-70">📷 {p.credit}</span> : null}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={onDialogClose}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') step(1);
          if (e.key === 'ArrowLeft') step(-1);
        }}
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          touchX.current = null;
          if (start == null || end == null) return;
          if (end - start > 50) step(-1);
          if (start - end > 50) step(1);
        }}
        aria-label="Photo viewer"
        className="m-auto max-h-[100dvh] w-full max-w-3xl bg-transparent p-3 text-ink backdrop:bg-black/85"
      >
        {current ? (
          <figure className="pop-in flex flex-col gap-3">
            <div className="relative overflow-hidden rounded-sm border-[length:var(--line)] border-outline bg-surface-2" style={{ aspectRatio: aspect(current), maxHeight: '72dvh' }}>
              <Image src={current.url} alt={current.caption ?? 'A night on the Square'} fill sizes="(min-width: 768px) 768px, 100vw" className="object-contain" priority />
            </div>
            <figcaption className="flex flex-wrap items-center justify-between gap-2 text-sm text-paper">
              <span className="font-hand text-lg">
                {current.caption}
                {current.credit ? <span className="ml-2 text-sm opacity-80">📷 {current.credit}</span> : null}
              </span>
              <Link href={`/gallery/takedown?photo=${current.id}`} className="font-bold underline decoration-2 underline-offset-4">
                Request removal
              </Link>
            </figcaption>
            <div className="flex items-center justify-between gap-2">
              <LightboxButton onClick={() => step(-1)} label="Previous photo" disabled={photos.length < 2}>
                ←
              </LightboxButton>
              <span className="text-sm font-bold text-paper" aria-live="polite">
                {open! + 1} / {photos.length}
              </span>
              <LightboxButton onClick={() => step(1)} label="Next photo" disabled={photos.length < 2}>
                →
              </LightboxButton>
              <LightboxButton onClick={close} label="Close" autoFocus>
                ✕
              </LightboxButton>
            </div>
          </figure>
        ) : null}
      </dialog>
    </>
  );
}

function LightboxButton({ children, label, ...rest }: { children: React.ReactNode; label: string } & React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-label={label}
      className="press shadow-hard-sm grid h-12 min-w-12 place-items-center rounded-sm border-[length:var(--line-thin)] border-outline bg-paper px-3 font-display text-lg text-paper-ink disabled:opacity-40"
      {...rest}
    >
      {children}
    </button>
  );
}

function aspect(p: PublicPhoto): string {
  return p.width && p.height ? `${p.width} / ${p.height}` : '4 / 5';
}
