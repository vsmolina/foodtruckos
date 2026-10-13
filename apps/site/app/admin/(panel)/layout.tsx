import Link from 'next/link';
import { AdminNav } from '@/components/admin/AdminNav';
import { requireAdmin } from '@/lib/auth';
import { signOut } from '@/app/admin/login/actions';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <header className="border-b-[length:var(--line)] border-outline bg-bg">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/admin" className="font-display text-lg uppercase no-underline">
              Barrio <span className="text-marigold">Admin</span>
            </Link>
            <div className="flex items-center gap-3 text-sm">
              <Link href="/" className="font-bold underline">
                View site
              </Link>
              <form action={signOut}>
                <button type="submit" className="min-h-11 font-bold underline">
                  Sign out
                </button>
              </form>
            </div>
          </div>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </>
  );
}
