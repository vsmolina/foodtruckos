import type { ApiResult, FieldErrors } from '@barrio/site-contract';
import type { z } from 'zod';

// Shared result helpers for admin logic. The same functions back the site's
// own admin (server actions) and the admin API the truck dashboard calls, so
// both return the contract's ApiResult shape.

export type Result<T> = ApiResult<T>;

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });

export const fail = (error: string, fieldErrors?: FieldErrors): { ok: false; error: string; fieldErrors?: FieldErrors } =>
  fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };

/** First message per top-level field. */
export function flattenZod(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? '');
    out[key] ??= issue.message;
  }
  return out;
}

export const invalid = (err: z.ZodError) => fail('Check the highlighted fields.', flattenZod(err));
