import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { subscribers } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { prettyPhone } from '@/lib/format';
import { validTwilioSignature } from '@/lib/messaging/sms';

// Inbound SMS (Twilio → Messaging Service → "A message comes in" webhook).
// Twilio's Advanced Opt-Out already confirms STOP/START itself; we record the
// choice so broadcasts skip stopped numbers, and answer HELP with contact info.

const STOP = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'REVOKE', 'OPTOUT']);
const START = new Set(['START', 'UNSTOP', 'YES', 'SUBSCRIBE']);
const HELP = new Set(['HELP', 'INFO']);

function twiml(message?: string): Response {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message></Response>`
    : '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  return new Response(body, { headers: { 'content-type': 'text/xml' } });
}

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);

  const url = `${env.siteUrl}/api/webhooks/twilio`;
  if (!validTwilioSignature(req.headers.get('x-twilio-signature'), url, params)) {
    return new Response('Invalid signature', { status: 403 });
  }

  const from = params.From ?? '';
  const word = (params.Body ?? '').trim().toUpperCase().replace(/[^A-Z]/g, '');

  if (STOP.has(word)) {
    await db.update(subscribers).set({ smsStoppedAt: new Date() }).where(eq(subscribers.phone, from));
    return twiml();
  }
  if (START.has(word)) {
    await db.update(subscribers).set({ smsStoppedAt: null, smsOptIn: true }).where(eq(subscribers.phone, from));
    return twiml();
  }
  if (HELP.has(word)) {
    const owner = process.env.OWNER_PHONE ? ` or call ${prettyPhone(process.env.OWNER_PHONE)}` : '';
    return twiml(
      `Barrio Burger Co. specials & order alerts. Up to 4 msgs/mo for specials. Msg&data rates may apply. Help: ${env.siteUrl}/terms#sms${owner}. Reply STOP to cancel.`,
    );
  }
  // Anything else: no auto-reply (a person may read it in the Twilio console).
  return twiml();
}
