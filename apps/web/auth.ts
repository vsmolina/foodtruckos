import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { verifyPassword } from '@/lib/auth/password';

// Auth.js v5. Single-admin email + password login for Victor's dashboard.
//
// The Credentials provider requires the JWT session strategy (it cannot use a
// database adapter for sessions), so there is no adapter here — `authorize()`
// does its own lookup against the `users` table. `proxy.ts` still gates the
// dashboard optimistically on the presence of the `authjs.session-token`
// cookie; the authoritative check is `await auth()` in the (dashboard) layout.
//
// `trustHost` is required off-Vercel (we run on the truck LAN). `AUTH_SECRET`
// signs the JWT and is read from the environment automatically.
const ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      // Return a user object to sign in, or null to reject. Only the one
      // configured admin may sign in, and only with a matching password.
      authorize: async (credentials) => {
        const email = typeof credentials?.email === 'string' ? credentials.email.toLowerCase() : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';
        if (!email || !password) return null;
        if (!ADMIN_EMAIL || email !== ADMIN_EMAIL) return null;

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user?.passwordHash) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
