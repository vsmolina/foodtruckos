import 'server-only';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { InstagramPostDto, InstagramStatusDto } from '@barrio/site-contract';
import * as ig from '@/lib/instagram';
import { fail, invalid, ok, type Result } from './result';

// Connecting the owner's Instagram for the gallery. No auth here: callers
// (admin server actions, admin API) check it first. The token never comes back
// out of these functions.

const refresh = (): void => revalidatePath('/', 'layout');

function postDto(p: ig.InstagramPost): InstagramPostDto {
  return {
    id: p.id,
    permalink: p.permalink,
    mediaType: p.mediaType as InstagramPostDto['mediaType'],
    postedAt: p.postedAt.toISOString(),
  };
}

export async function instagramStatus(): Promise<InstagramStatusDto> {
  const [account, posts] = await Promise.all([ig.getAccount(), ig.getInstagramPosts()]);
  if (!account) return { connected: false };
  return {
    connected: true,
    username: account.username,
    connectedAt: account.connectedAt.toISOString(),
    tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
    lastFetchedAt: account.lastFetchedAt?.toISOString() ?? null,
    lastError: account.lastError,
    posts: posts.map(postDto),
    oembed: posts[0] ? (await ig.oembedHtml(posts[0].permalink)) !== null : false,
  };
}

const ConnectInput = z.object({
  accessToken: z
    .string()
    .trim()
    .min(20, 'Paste the whole access token.')
    .max(2000, 'That’s too long for an access token.')
    .regex(/^\S+$/, 'Access tokens have no spaces. Copy it again.'),
});

export async function connectInstagram(input: unknown): Promise<Result<InstagramStatusDto>> {
  const parsed = ConnectInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { accessToken } = parsed.data;
  let account: { id: string; username: string };
  try {
    account = await ig.lookupAccount(accessToken);
  } catch (err) {
    const message = err instanceof ig.InstagramError ? err.message : 'Couldn’t check that token with Instagram.';
    return fail(message, { accessToken: message });
  }
  await ig.saveAccount(accessToken, account);
  // Pull posts right away; a problem here shows as lastError, the connection stays.
  await ig.refreshNow();
  refresh();
  return ok(await instagramStatus());
}

export async function refreshInstagram(): Promise<Result<InstagramStatusDto>> {
  if (!(await ig.getAccount())) return fail('Instagram isn’t connected yet.');
  const error = await ig.refreshNow();
  refresh();
  if (error) return fail(error);
  return ok(await instagramStatus());
}

export async function disconnectInstagram(): Promise<Result<InstagramStatusDto>> {
  await ig.disconnect();
  refresh();
  return ok({ connected: false });
}
