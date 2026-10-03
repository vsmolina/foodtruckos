import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// Password hashing with Node's built-in scrypt — no external dependency. Stored
// format is `scrypt$<saltHex>$<hashHex>`, self-describing so the scheme can be
// rotated later without guessing. 16-byte salt, 64-byte derived key.
const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const derived = (await scryptAsync(password, salt, expected.length)) as Buffer;

  // Constant-time compare; guard lengths first (timingSafeEqual throws on mismatch).
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
