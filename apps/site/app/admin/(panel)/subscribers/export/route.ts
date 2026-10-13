import { asc } from 'drizzle-orm';
import { isAdmin } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { subscribers } from '@/lib/db/schema';
import { emailActive, smsActive } from '@/lib/subscribers';

export const dynamic = 'force-dynamic';

function cell(v: unknown): string {
  const s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
  // Quote, escape quotes, and neutralise spreadsheet formulas.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(): Promise<Response> {
  if (!(await isAdmin())) return new Response('Unauthorized', { status: 401 });
  const rows = await db.select().from(subscribers).orderBy(asc(subscribers.createdAt));
  const header = ['email', 'phone', 'email_active', 'sms_active', 'consent_text', 'consent_at', 'source', 'email_unsubscribed_at', 'sms_stopped_at', 'created_at'];
  const lines = rows.map((r) =>
    [r.email, r.phone, emailActive(r), smsActive(r), r.consentText, r.consentAt, r.source, r.emailUnsubscribedAt, r.smsStoppedAt, r.createdAt].map(cell).join(','),
  );
  return new Response([header.join(','), ...lines].join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="barrio-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
