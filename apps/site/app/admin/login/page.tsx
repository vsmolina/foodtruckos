import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await isAdmin()) redirect('/admin');
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="font-display text-h2 uppercase">
        Barrio <span className="text-marigold">Admin</span>
      </h1>
      {process.env.ADMIN_PASSWORD_HASH ? null : (
        <p className="rounded-md border-2 border-outline bg-marigold p-3 text-sm font-bold text-on-marigold">
          ADMIN_PASSWORD_HASH isn’t set. Run <code>pnpm --filter site admin:hash-password &apos;…&apos;</code> and add it to .env.
        </p>
      )}
      <LoginForm />
    </div>
  );
}
