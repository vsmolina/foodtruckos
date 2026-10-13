import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

// Single-owner admin. The password hash lives in ADMIN_PASSWORD_HASH
// (base64 bcrypt, from `pnpm --filter site admin:hash-password`); the session is a signed,
// http-only cookie that lasts 30 days.

export const SESSION_COOKIE = 'bb_admin';
const MAX_AGE = 60 * 60 * 24 * 30;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET must be at least 32 characters');
    return new TextEncoder().encode('dev-only-session-secret-change-me-please');
  }
  return new TextEncoder().encode(s);
}

export async function checkPassword(password: string): Promise<boolean> {
  // Stored base64-encoded: a raw bcrypt hash is full of `$`, which .env
  // variable expansion would mangle.
  const encoded = process.env.ADMIN_PASSWORD_HASH;
  if (!encoded) return false;
  return bcrypt.compare(password, Buffer.from(encoded, 'base64').toString('utf8'));
}

export async function startSession(): Promise<void> {
  const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    return true;
  } catch {
    return false;
  }
}

/** Use at the top of every admin page and admin server action. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/login');
}
