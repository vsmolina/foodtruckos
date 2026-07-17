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
    <div className="grid min-h-screen grid-cols-[13rem_1fr] bg-bg text-ink">
      <aside className="flex flex-col border-r border-[var(--rule)] bg-bg-raised p-4">
        <div className="px-2 font-display text-lg">foodtruck&#8202;os</div>
        <nav className="mt-6 flex flex-col gap-1">
          <NavLink href="/">Today</NavLink>
          <NavLink href="/orders">Orders</NavLink>
          <NavLink href="/reports">Reports</NavLink>
          <NavLink href="/settings/menu">Menu</NavLink>
        </nav>
        <div className="mt-auto border-t border-[var(--rule)] pt-3">
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
      <main className="min-w-0 p-6">{children}</main>
    </div>
  );
}
