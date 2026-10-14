/** Field name → first error message (form field names match input keys). */
export type FieldErrors = Record<string, string>;

/**
 * Every response body. Validation and "not allowed" failures are `ok: false`
 * with HTTP 4xx; `fieldErrors` keys match the op's input keys.
 */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: FieldErrors };

/** Dates cross the wire as ISO strings. */
export type IsoDate = string;

/**
 * Image URL as stored by the site: absolute (Vercel Blob) or site-relative
 * (`/uploads/...` in dev). Callers resolve relative ones against SITE_URL.
 */
export type ImageUrl = string;

/**
 * Ops that take a file accept multipart/form-data: an `input` part holding the
 * JSON input, plus file parts named as documented on the op (e.g. `photo`).
 */
export type Empty = Record<string, never>;
