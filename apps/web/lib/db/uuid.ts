import { uuidv7 } from 'uuidv7';

/**
 * Generate a UUIDv7 — time-ordered so primary keys sort by creation time.
 * Used as the default for every table's `id`. See docs/01-ARCHITECTURE.md.
 */
export function v7(): string {
  return uuidv7();
}
