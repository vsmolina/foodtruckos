'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LogoSlot } from '@/components/ui/Slots';
import { cx } from '@/lib/cx';
import { NAV } from './nav';

const DESKTOP = ['/menu', '/order', '/find-us', '/gallery', '/story', '/catering', '/merch'];

export function Header({ cartCount }: { cartCount?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <header className="relative z-20 border-b-[length:var(--line)] border-outline bg-bg">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2.5 no-underline" aria-label="Barrio Burger Co. — home">
          <LogoSlot size="sm" />
          <span className="font-display text-lg uppercase leading-none tracking-wide">
            Barrio <span className="text-marigold">Burger</span> Co.
          </span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.filter((n) => DESKTOP.includes(n.href)).map((n) => {
              const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'rounded-sm px-3 py-2 text-sm font-bold no-underline hover:bg-surface-2',
                      active && 'bg-marigold text-on-marigold hover:bg-marigold',
                    )}
                  >
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="press shadow-hard-sm ml-auto inline-flex min-h-11 items-center gap-2 rounded-sm border-[length:var(--line-thin)] border-outline bg-paper px-3 font-display text-sm uppercase text-paper-ink lg:ml-2"
        >
          <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
            <path d="M2 5h16M2 10h13M2 15h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="lg:hidden">Menu</span>
          <span className="hidden lg:inline">More</span>
          {cartCount ? (
            <span className="ml-1 rounded-full bg-chile px-1.5 text-xs text-on-chile">{cartCount}</span>
          ) : null}
        </button>
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        aria-label="Site menu"
        className="m-0 ml-auto h-dvh max-h-none w-full max-w-sm bg-bg p-0 text-ink backdrop:bg-black/60 open:rise-in"
      >
        <div className="flex h-full flex-col border-l-[length:var(--line)] border-outline">
          <div className="flex h-16 items-center justify-between border-b-[length:var(--line)] border-outline px-4">
            <span className="font-hand text-xl text-marigold">¿A dónde?</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="press shadow-hard-sm grid h-11 w-11 place-items-center rounded-sm border-[length:var(--line-thin)] border-outline bg-paper text-paper-ink"
              aria-label="Close menu"
            >
              <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <nav aria-label="Site" className="flex-1 overflow-y-auto p-4">
            <ul className="flex flex-col gap-2">
              {NAV.map((n, i) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    aria-current={pathname === n.href ? 'page' : undefined}
                    className={cx(
                      'press shadow-hard-sm flex min-h-14 items-center justify-between rounded-sm border-[length:var(--line-thin)] border-outline px-4 no-underline',
                      i === 1 ? 'bg-chile text-on-chile' : 'bg-surface text-ink',
                      pathname === n.href && i !== 1 && 'bg-marigold text-on-marigold',
                    )}
                  >
                    <span className="font-display text-lg uppercase">{n.label}</span>
                    <span className="font-hand text-sm opacity-80">{n.es}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </dialog>
    </header>
  );
}
