import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';

// Magic-link sign-in. One admin only (enforced in auth.ts). No password.
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
            {error === 'AccessDenied'
              ? 'That email is not authorized.'
              : 'Something went wrong. Try again.'}
          </p>
        ) : null}

        <form
          action={async (formData) => {
            'use server';
            await signIn('nodemailer', {
              email: String(formData.get('email') ?? ''),
              redirectTo: '/',
            });
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
          <button
            type="submit"
            className="mt-1 rounded-[var(--radius)] bg-accent px-3 py-2 font-medium text-accent-ink transition-colors hover:opacity-90"
          >
            Email me a sign-in link
          </button>
        </form>
      </div>
    </main>
  );
}
