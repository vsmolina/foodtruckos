import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth';
import { NavLink } from '@/components/dashboard/NavLink';

// Owner dashboard shell. This is the authoritative auth gate — proxy.ts only
// does an optimistic cookie check; here we resolve the real database session.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div className="min-h-screen bg-bg text-ink md:grid md:grid-cols-[13rem_1fr]">
      {/* Phones: a top bar with a scrollable nav row. md+: the sidebar. */}
      <aside className="flex flex-col border-b border-[var(--rule)] bg-bg-raised px-4 pt-3 md:border-b-0 md:border-r md:p-4">
        <div className="flex items-center justify-between md:block">
          <div className="px-2 font-display text-lg">foodtruck&#8202;os</div>
          <form
            className="md:hidden"
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button type="submit" className="rounded-[var(--radius)] px-2 py-1.5 text-sm text-ink-2 hover:bg-bg-sunken">
              Sign out
            </button>
          </form>
        </div>
        <nav className="-mx-4 mt-2 flex gap-1 overflow-x-auto px-4 pb-2 md:mx-0 md:mt-6 md:flex-col md:overflow-visible md:px-0 md:pb-0">
          <NavLink href="/">Today</NavLink>
          <NavLink href="/orders">Orders</NavLink>
          <NavLink href="/reports">Reports</NavLink>
          <NavLink href="/settings/menu">Menu</NavLink>
          <NavLink href="/website">Website</NavLink>
        </nav>
        <div className="mt-auto hidden border-t border-[var(--rule)] pt-3 md:block">
          <div className="truncate px-2 text-xs text-ink-3" title={session.user.email ?? ''}>
            {session.user.email}
          </div>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button
              type="submit"
              className="mt-2 w-full rounded-[var(--radius)] px-2 py-1.5 text-left text-sm text-ink-2 hover:bg-bg-sunken"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 p-4 md:p-6">{children}</main>
    </div>
  );
}
