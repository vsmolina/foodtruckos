import NextAuth, { type NextAuthConfig } from 'next-auth';
import Nodemailer from 'next-auth/providers/nodemailer';

// next-auth beta's NodemailerConfig return type doesn't satisfy the provider
// union under our `exactOptionalPropertyTypes: true` (an internal
// sendVerificationRequest/server optionality quirk, not our config). The config
// object below is still fully type-checked by the Nodemailer() call; we only
// assert the return to the array's element type.
type Provider = NonNullable<NextAuthConfig['providers']>[number];
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/lib/db/client';
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema';

// Auth.js v5. Single-admin magic-link login for Victor's dashboard.
//
// The Nodemailer (email) provider requires the database adapter — it persists
// verification tokens and, on success, a user + session row. Session strategy is
// therefore `database` (the default with an adapter). The session cookie holds an
// opaque token; `proxy.ts` can only check its *presence*, so the real gate is
// `await auth()` in the (dashboard) layout.
//
// `trustHost` is required off-Vercel (we run on the truck LAN). `AUTH_SECRET`
// is read from the environment automatically.
const ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: 'database' },
  trustHost: true,
  pages: { signIn: '/login' },
  providers: [
    Nodemailer({
      // Gmail SMTP over implicit TLS. Use a Google *App Password*, never the
      // account password (see docs/TESTING.md / .env.example).
      server: {
        host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT ?? 465),
        secure: true,
        auth: { user: process.env.SMTP_USER ?? '', pass: process.env.SMTP_PASSWORD ?? '' },
      },
      from: process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? '',
    }) as Provider,
  ],
  callbacks: {
    // Only the one configured admin may sign in. The email provider identifies
    // the user by `user.email`; reject everyone else even if they somehow get a
    // valid magic link for another address.
    signIn({ user }) {
      const email = user.email?.toLowerCase();
      return Boolean(email && ADMIN_EMAIL && email === ADMIN_EMAIL);
    },
  },
});
