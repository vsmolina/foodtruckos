import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';

// Email + password sign-in. One admin only (enforced in auth.ts).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}): Promise<React.JSX.Element> {
  const session = await auth();
  if (session?.user) redirect('/');

  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--rule)] bg-bg-raised p-8">
        <h1 className="font-display text-2xl text-ink">foodtruck&#8202;os</h1>
        <p className="mt-1 text-sm text-ink-3">Sign in to the owner dashboard.</p>

        {error ? (
          <p className="mt-4 rounded-[var(--radius)] border border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-3 py-2 text-sm text-danger">
            {error === 'CredentialsSignin'
              ? 'Incorrect email or password.'
              : 'Something went wrong. Try again.'}
          </p>
        ) : null}

        <form
          action={async (formData) => {
            'use server';
            try {
              await signIn('credentials', {
                email: String(formData.get('email') ?? ''),
                password: String(formData.get('password') ?? ''),
                redirectTo: '/',
              });
            } catch (err) {
              // A failed sign-in throws AuthError; a successful one throws a
              // redirect we must re-throw so Next can perform the navigation.
              if (err instanceof AuthError) redirect('/login?error=CredentialsSignin');
              throw err;
            }
          }}
          className="mt-6 flex flex-col gap-3"
        >
          <label className="text-sm text-ink-2" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="rounded-[var(--radius)] border border-[var(--rule)] bg-bg px-3 py-2 text-ink outline-none focus:border-[var(--accent)]"
          />
          <label className="mt-1 text-sm text-ink-2" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="rounded-[var(--radius)] border border-[var(--rule)] bg-bg px-3 py-2 text-ink outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            className="mt-2 rounded-[var(--radius)] bg-accent px-3 py-2 font-medium text-accent-ink transition-colors hover:opacity-90"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
