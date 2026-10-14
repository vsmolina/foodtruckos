import 'server-only';
import { and, desc, eq, isNull, lt, notInArray, or } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { instagramAccount, instagramPosts, siteSettings } from '@/lib/db/schema';
import { env } from '@/lib/env';

// The owner's latest Instagram posts on /gallery, shown as Instagram's own
// embeds. Two credentials, both optional until set:
// - The account token (Instagram API with Instagram Login; Professional
//   account), pasted once in the Gallery admin. It finds the newest posts. We
//   renew it weekly (tokens last 60 days) and store only each post's id, link,
//   type and date. Refreshes happen at most every 30 min after a gallery view,
//   plus a daily cron so the token stays alive with no traffic.
// - INSTAGRAM_APP_ID + INSTAGRAM_CLIENT_TOKEN for Meta's oEmbed endpoint, which
//   returns the embed HTML. It needs Meta's "oEmbed Read" app review; until
//   then (or on any error) we render Instagram's standard embed markup, which
//   looks the same.

/** Overridable outside production so the flow can be exercised against a local mock. */
const API = (!env.isProd && process.env.INSTAGRAM_API_BASE) || 'https://graph.instagram.com';
export const INSTAGRAM_SHOWN = 3;
const STALE_MS = 30 * 60_000;
const TOKEN_RENEW_MS = 7 * 24 * 3600_000;
const TOKEN_LIFETIME_S = 60 * 24 * 3600;
const OEMBED = 'https://graph.facebook.com/v25.0/instagram_oembed';

export type InstagramAccount = typeof instagramAccount.$inferSelect;
export type InstagramPost = typeof instagramPosts.$inferSelect;

export class InstagramError extends Error {
  constructor(
    message: string,
    /** The token is dead: only reconnecting fixes it. */
    readonly tokenInvalid = false,
  ) {
    super(message);
  }
}

type IgMedia = {
  id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  permalink?: string;
  timestamp: string;
};

async function igGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(path, API);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new InstagramError('Couldn’t reach Instagram. It will try again shortly.');
  }
  const body = (await res.json().catch(() => null)) as { error?: { message?: string; code?: number } } | null;
  if (!res.ok || body?.error) {
    const code = body?.error?.code;
    if (code === 190 || res.status === 401) {
      throw new InstagramError('Instagram didn’t accept the access token (expired, revoked or copied wrong). Generate a new one and connect again.', true);
    }
    if (code === 4 || code === 17 || code === 32 || res.status === 429) {
      throw new InstagramError('Instagram is rate-limiting requests. It will try again later.');
    }
    throw new InstagramError(`Instagram said: ${body?.error?.message ?? `HTTP ${res.status}`}`.slice(0, 300));
  }
  return body as T;
}

/** Checks a token and returns the account it belongs to. */
export async function lookupAccount(accessToken: string): Promise<{ id: string; username: string }> {
  const me = await igGet<{ id?: string; username?: string }>('/me', { fields: 'id,username', access_token: accessToken });
  if (!me.id || !me.username) throw new InstagramError('That token didn’t return an Instagram account.');
  return { id: me.id, username: me.username };
}

export async function getAccount(): Promise<InstagramAccount | null> {
  const [row] = await db.select().from(instagramAccount).where(eq(instagramAccount.id, 1));
  return row ?? null;
}

/** The posts shown on /gallery, newest first. */
export async function getInstagramPosts(): Promise<InstagramPost[]> {
  return db.select().from(instagramPosts).orderBy(desc(instagramPosts.postedAt)).limit(INSTAGRAM_SHOWN);
}

/**
 * Save a (checked) token. Switching accounts clears the old account's posts;
 * the site-wide Instagram handle follows the connected account.
 */
export async function saveAccount(accessToken: string, account: { id: string; username: string }): Promise<void> {
  const previous = await getAccount();
  if (previous && previous.igUserId !== account.id) await clearPosts();
  const now = new Date();
  const values = {
    accessToken,
    igUserId: account.id,
    username: account.username,
    // Tokens made in the Meta dashboard last 60 days; the first renewal records the exact expiry.
    tokenExpiresAt: new Date(now.getTime() + TOKEN_LIFETIME_S * 1000),
    tokenRefreshedAt: now,
    lastFetchedAt: null,
    lastError: null,
  };
  await db
    .insert(instagramAccount)
    .values({ id: 1, ...values, connectedAt: now })
    .onConflictDoUpdate({ target: instagramAccount.id, set: { ...values, connectedAt: now } });
  await db.update(siteSettings).set({ instagram: account.username }).where(eq(siteSettings.id, 1));
}

export async function disconnect(): Promise<void> {
  await db.delete(instagramAccount);
  await clearPosts();
}

async function clearPosts(): Promise<void> {
  await db.delete(instagramPosts);
}

/**
 * Take the refresh lock: only one refresh runs per `staleMs` window, however
 * many page views ask for one. Returns the account when this caller won.
 */
async function claim(staleMs: number): Promise<InstagramAccount | null> {
  const cutoff = new Date(Date.now() - staleMs);
  const [row] = await db
    .update(instagramAccount)
    .set({ lastFetchedAt: new Date() })
    .where(and(eq(instagramAccount.id, 1), or(isNull(instagramAccount.lastFetchedAt), lt(instagramAccount.lastFetchedAt, cutoff))))
    .returning();
  return row ?? null;
}

/** For page views and the cron: refreshes only when the last fetch is 30+ min old. Never throws. */
export async function refreshIfStale(): Promise<void> {
  try {
    const account = await claim(STALE_MS);
    if (account) await run(account);
  } catch (err) {
    console.error('[instagram] refresh failed', err);
  }
}

/** Admin "Refresh now" (and right after connecting). Returns the error, if any. */
export async function refreshNow(): Promise<string | null> {
  const account = await claim(5_000);
  if (!account) return (await getAccount())?.lastError ?? null;
  return run(account);
}

async function run(account: InstagramAccount): Promise<string | null> {
  try {
    const token = await renewTokenIfDue(account);
    await syncPosts(token);
    await db.update(instagramAccount).set({ lastError: null }).where(eq(instagramAccount.id, 1));
    return null;
  } catch (err) {
    const message = err instanceof InstagramError ? err.message : 'Something went wrong refreshing Instagram posts.';
    if (!(err instanceof InstagramError)) console.error('[instagram] refresh failed', err);
    await db.update(instagramAccount).set({ lastError: message }).where(eq(instagramAccount.id, 1));
    return message;
  }
}

/** Long-lived tokens can be renewed once they're a day old; we do it weekly. */
async function renewTokenIfDue(account: InstagramAccount): Promise<string> {
  if (Date.now() - account.tokenRefreshedAt.getTime() < TOKEN_RENEW_MS) return account.accessToken;
  try {
    const r = await igGet<{ access_token?: string; expires_in?: number }>('/refresh_access_token', {
      grant_type: 'ig_refresh_token',
      access_token: account.accessToken,
    });
    if (!r.access_token) return account.accessToken;
    const now = new Date();
    await db
      .update(instagramAccount)
      .set({
        accessToken: r.access_token,
        tokenRefreshedAt: now,
        tokenExpiresAt: new Date(now.getTime() + (r.expires_in ?? TOKEN_LIFETIME_S) * 1000),
      })
      .where(eq(instagramAccount.id, 1));
    return r.access_token;
  } catch (err) {
    // A failed renewal isn't fatal while the old token still works; a dead token is.
    if (err instanceof InstagramError && err.tokenInvalid) throw err;
    console.warn('[instagram] token renewal failed; will retry', err);
    return account.accessToken;
  }
}

/** Keep the newest posts' ids and links; drop what fell off. */
async function syncPosts(accessToken: string): Promise<void> {
  const { data = [] } = await igGet<{ data?: IgMedia[] }>('/me/media', {
    fields: 'id,media_type,permalink,timestamp',
    limit: String(INSTAGRAM_SHOWN * 3),
    access_token: accessToken,
  });
  // Posts with copyrighted audio come back without a permalink and can't be embedded.
  const latest = data.filter((m) => m.permalink).slice(0, INSTAGRAM_SHOWN);
  for (const m of latest) {
    const fields = { permalink: m.permalink!, mediaType: m.media_type, postedAt: new Date(m.timestamp) };
    await db.insert(instagramPosts).values({ id: m.id, ...fields }).onConflictDoUpdate({ target: instagramPosts.id, set: fields });
  }
  const keep = latest.map((m) => m.id);
  await db.delete(instagramPosts).where(keep.length ? notInArray(instagramPosts.id, keep) : undefined);
}

/**
 * Embed HTML for one post from Meta's oEmbed endpoint (cached an hour), or
 * null to use the standard markup. Only Instagram's own blockquote is accepted:
 * the script is loaded by the page, never from this HTML.
 */
export async function oembedHtml(permalink: string): Promise<string | null> {
  const appId = process.env.INSTAGRAM_APP_ID;
  const clientToken = process.env.INSTAGRAM_CLIENT_TOKEN;
  if (!appId || !clientToken) return null;
  const url = new URL(OEMBED);
  url.searchParams.set('url', permalink);
  url.searchParams.set('omitscript', 'true');
  url.searchParams.set('maxwidth', '540');
  url.searchParams.set('access_token', `${appId}|${clientToken}`);
  try {
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5_000) });
    const body = (await res.json().catch(() => null)) as { html?: string; error?: { message?: string } } | null;
    if (!res.ok || typeof body?.html !== 'string') {
      warnOnce(body?.error?.message ?? `HTTP ${res.status}`);
      return null;
    }
    const html = body.html.trim();
    if (!html.startsWith('<blockquote class="instagram-media"') || /<\s*(script|iframe|style)|\son\w+\s*=/i.test(html)) return null;
    return html;
  } catch {
    return null;
  }
}

let warned = false;
function warnOnce(message: string): void {
  if (warned) return;
  warned = true;
  console.warn(`[instagram] oEmbed unavailable, using standard embeds: ${message}`);
}

const PERMALINK = /^https:\/\/www\.instagram\.com\/(?:[\w.]+\/)?(?:p|reel|tv)\/[\w-]+\/?$/;

/** Instagram's standard embed markup (what the "Embed" button gives), for when oEmbed isn't available. */
export function standardEmbedHtml(permalink: string): string | null {
  if (!PERMALINK.test(permalink)) return null;
  const url = permalink.endsWith('/') ? permalink : `${permalink}/`;
  return (
    `<blockquote class="instagram-media" data-instgrm-permalink="${url}?utm_source=ig_embed" data-instgrm-version="14" ` +
    `style="background:#FFF;border:0;margin:0;max-width:540px;min-width:0;padding:0;width:100%;">` +
    `<a href="${url}" target="_blank" rel="noopener" style="display:block;padding:24px 16px;text-align:center;color:#3897f0;font:600 14px/1.4 system-ui,sans-serif;">View this post on Instagram</a>` +
    `</blockquote>`
  );
}

/** The posts for /gallery with their embed HTML, oEmbed first. */
export async function getEmbeds(): Promise<Array<{ id: string; permalink: string; html: string }>> {
  const posts = await getInstagramPosts();
  const out = await Promise.all(
    posts.map(async (p) => {
      const html = (await oembedHtml(p.permalink)) ?? standardEmbedHtml(p.permalink);
      return html ? { id: p.id, permalink: p.permalink, html } : null;
    }),
  );
  return out.filter((p) => p !== null);
}
