import { subscribersCsv } from '@/lib/admin/subscribers';
import { isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  if (!(await isAdmin())) return new Response('Unauthorized', { status: 401 });
  const { filename, csv } = await subscribersCsv();
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
