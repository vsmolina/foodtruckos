import Link from 'next/link';
import { toggleTheme } from '@/app/actions/theme';
import { LogoSlot } from '@/components/ui/Slots';
import { ZigzagDivider } from '@/components/ui/Doodles';
import type { Settings } from '@/lib/status';
import { NAV } from './nav';

export function Footer({ settings }: { settings: Settings }) {
  return (
    <footer className="relative z-10 mt-16 border-t-[length:var(--line)] border-outline bg-surface pb-24 lg:pb-0">
      <ZigzagDivider className="-mt-[3px]" />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <LogoSlot size="lg" />
          <p className="font-hand text-xl text-marigold tilt-c">¡Puro barrio, pura sabrosura!</p>
        </div>
        <div>
          <h2 className="font-display text-sm uppercase text-ink-muted">Find the truck</h2>
          <p className="mt-2 font-bold">{settings.locationName}</p>
          <p className="text-ink-muted">{settings.address}</p>
          <Link href="/find-us" className="mt-2 inline-block font-bold text-link underline decoration-2 underline-offset-4">
            Hours &amp; map
          </Link>
        </div>
        <nav aria-label="Footer">
          <h2 className="font-display text-sm uppercase text-ink-muted">Explore</h2>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="inline-block py-1 hover:text-marigold">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-3 text-sm">
          <h2 className="font-display text-sm uppercase text-ink-muted">Síguenos</h2>
          <a
            href={`https://instagram.com/${settings.instagram}`}
            className="inline-block font-bold text-link underline decoration-2 underline-offset-4"
            rel="noopener"
          >
            @{settings.instagram} on Instagram
          </a>
          <Link href="/specials" className="font-bold text-link underline decoration-2 underline-offset-4">
            Get specials by text or email
          </Link>
          <form action={toggleTheme}>
            <button type="submit" className="min-h-11 text-left font-bold underline decoration-2 underline-offset-4">
              Switch light / dark
            </button>
          </form>
          <p className="text-ink-muted">
            <Link href="/privacy" className="underline">
              Privacy
            </Link>{' '}
            ·{' '}
            <Link href="/terms" className="underline">
              Terms
            </Link>{' '}
            · © {new Date().getFullYear()} Barrio Burger Co. LLC
          </p>
        </div>
      </div>
    </footer>
  );
}
