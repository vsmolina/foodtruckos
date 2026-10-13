import type { ApiResult, SiteOpInput, SiteOpName, SiteOpOutput } from '@barrio/site-contract';
import { logger } from '@/lib/logger';

// Client for the customer website's admin API (apps/site, /api/admin/v1/<op>).
// Server-side only: the bearer token is full admin on the website and must
// never reach a browser (no NEXT_PUBLIC_, only called from server code).
// Contract: packages/site-contract.

const TIMEOUT_MS = 10_000;
const UPLOAD_TIMEOUT_MS = 45_000;

export function siteConfigured(): boolean {
  return Boolean(process.env.SITE_URL) && (process.env.SITE_ADMIN_API_TOKEN ?? '').length >= 32;
}

/** The website's public base URL, without a trailing slash. */
export function siteUrl(): string {
  return (process.env.SITE_URL ?? '').replace(/\/+$/, '');
}

/** Absolute URL for a site image (Blob URLs are absolute; dev uploads are `/uploads/...`). */
export function siteAsset(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//.test(url) ? url : `${siteUrl()}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** Link to a public page on the website. */
export function sitePage(path = '/'): string {
  return `${siteUrl()}${path}`;
}

export type SiteResult<T> = ApiResult<T>;

/**
 * Call one admin op. Never throws: network failures, timeouts and website
 * errors all come back as `{ ok: false, error }` with a message fit for the
 * owner. Pass `files` for ops that take uploads (sent as multipart).
 */
export async function siteApi<K extends SiteOpName>(
  op: K,
  input: SiteOpInput<K>,
  files?: Record<string, Blob | null | undefined>,
): Promise<ApiResult<SiteOpOutput<K>>> {
  if (!siteConfigured()) {
    return { ok: false, error: 'The website isn’t connected. Set SITE_URL and SITE_ADMIN_API_TOKEN.' };
  }
  const realFiles = Object.entries(files ?? {}).filter((e): e is [string, Blob] => e[1] instanceof Blob && e[1].size > 0);
  let body: BodyInit;
  const headers: Record<string, string> = { authorization: `Bearer ${process.env.SITE_ADMIN_API_TOKEN}` };
  if (realFiles.length) {
    const form = new FormData();
    form.set('input', JSON.stringify(input));
    for (const [name, blob] of realFiles) form.append(name, blob);
    body = form;
  } else {
    body = JSON.stringify(input);
    headers['content-type'] = 'application/json';
  }

  try {
    const res = await fetch(`${siteUrl()}/api/admin/v1/${op}`, {
      method: 'POST',
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(realFiles.length ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => null)) as ApiResult<SiteOpOutput<K>> | null;
    if (json && typeof json === 'object' && 'ok' in json) return json;
    logger.error({ op, status: res.status }, 'website admin api: unexpected response');
    return { ok: false, error: `The website answered with an error (${res.status}).` };
  } catch (err) {
    const timeout = err instanceof Error && err.name === 'TimeoutError';
    logger.error({ op, err: err instanceof Error ? err.message : String(err) }, 'website admin api: request failed');
    return {
      ok: false,
      error: timeout ? 'The website took too long to answer. Try again.' : 'Couldn’t reach the website. Check the internet connection.',
    };
  }
}

/** Unwrap for pages: data, or throw so the tab's error boundary shows the message. */
export async function siteData<K extends SiteOpName>(op: K, input: SiteOpInput<K>): Promise<SiteOpOutput<K>> {
  const result = await siteApi(op, input);
  if (!result.ok) throw new SiteUnavailableError(result.error);
  return result.data;
}

export class SiteUnavailableError extends Error {
  override name = 'SiteUnavailableError';
}
