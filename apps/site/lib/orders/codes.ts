import { randomBytes, randomInt } from 'node:crypto';

// Order codes are called out at the window: 4 characters, no look-alikes (0/O, 1/I/L, 5/S, 2/Z, 8/B).
const ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679';

export function orderCode(): string {
  return Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

/** Unguessable token for the status-page URL. */
export function orderToken(): string {
  return randomBytes(32).toString('base64url');
}
