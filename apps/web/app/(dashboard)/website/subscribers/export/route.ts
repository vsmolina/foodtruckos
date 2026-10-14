import { auth } from '@/auth';
import { siteApi } from '@/lib/site/api';

// CSV of every subscriber (full contact details + consent), fetched from the
// website. Dashboard session required — route handlers aren't covered by the
// dashboard layout's auth gate.

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user) return new Response('Unauthorized', { status: 401 });
  const result = await siteApi('subscribers.exportCsv', {});
  if (!result.ok) return new Response(result.error, { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const filename = result.data.filename.replace(/[^\w.-]/g, '_');
  return new Response(result.data.csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
