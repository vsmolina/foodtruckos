import { NextResponse } from 'next/server';
import { adminApiAuthorized, adminApiEnabled } from '@/lib/admin-api/auth';
import type { OpFiles, OpHandler } from '@/lib/admin-api/define';
import { handlers, isOp } from '@/lib/admin-api/registry';
import { rateLimit } from '@/lib/rate-limit';

// Admin API for the truck dashboard (apps/web): POST /api/admin/v1/<op>.
// Body: JSON input, or multipart with an `input` JSON part plus file parts.
// Contract: packages/site-contract. Auth: Bearer SITE_ADMIN_API_TOKEN.

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });

async function readBody(req: Request): Promise<{ input: unknown; files: OpFiles } | null> {
  const type = req.headers.get('content-type') ?? '';
  if (type.startsWith('multipart/form-data')) {
    const form = await req.formData().catch(() => null);
    if (!form) return null;
    const files: OpFiles = new Map();
    let input: unknown = {};
    for (const [key, value] of form) {
      if (key === 'input' && typeof value === 'string') {
        try {
          input = JSON.parse(value);
        } catch {
          return null;
        }
      } else if (typeof value !== 'string' && value.size > 0) {
        files.set(key, [...(files.get(key) ?? []), value]);
      }
    }
    return { input, files };
  }
  const text = await req.text();
  if (!text) return { input: {}, files: new Map() };
  try {
    return { input: JSON.parse(text), files: new Map() };
  } catch {
    return null;
  }
}

export async function POST(req: Request, ctx: RouteContext<'/api/admin/v1/[op]'>): Promise<NextResponse> {
  if (!adminApiEnabled()) return json({ ok: false, error: 'Admin API is not configured.' }, 404);
  if (!adminApiAuthorized(req)) {
    // Throttle guessing; a correct token is never counted.
    const limited = !(await rateLimit('admin-api-fail', 20, 15 * 60));
    return json({ ok: false, error: limited ? 'Too many attempts.' : 'Unauthorized.' }, limited ? 429 : 401);
  }

  const { op } = await ctx.params;
  if (!isOp(op)) return json({ ok: false, error: `Unknown op: ${op}` }, 404);

  const body = await readBody(req);
  if (!body) return json({ ok: false, error: 'Malformed body.' }, 400);

  try {
    const handler = handlers[op] as OpHandler<typeof op>;
    const result = await handler(body.input, { files: body.files });
    return json(result, result.ok ? 200 : 422);
  } catch (err) {
    console.error(`[admin-api] ${op} failed`, err);
    return json({ ok: false, error: 'Something went wrong on the website.' }, 500);
  }
}
