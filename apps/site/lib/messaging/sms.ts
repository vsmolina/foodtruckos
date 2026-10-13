import 'server-only';
import twilio from 'twilio';
import { db } from '@/lib/db/client';
import { messageLog } from '@/lib/db/schema';
import { has } from '@/lib/env';

let client: ReturnType<typeof twilio> | null = null;

/**
 * Send one SMS. Without Twilio configured, the message is logged (console +
 * message_log) instead, so every flow works end to end in development.
 * Never throws: SMS is a nice-to-have on top of the status page.
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!has.twilio) {
    console.info(`[sms:logged] → ${to}: ${body}`);
    await db.insert(messageLog).values({ channel: 'sms', to, body, status: 'logged' });
    return true;
  }
  try {
    client ??= twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, { timeout: 5000 });
    const msg = await client.messages.create({
      to,
      body,
      ...(process.env.TWILIO_MESSAGING_SERVICE_SID
        ? { messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID }
        : { from: process.env.TWILIO_FROM_NUMBER! }),
    });
    await db.insert(messageLog).values({ channel: 'sms', to, body, status: 'sent', providerId: msg.sid });
    return true;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[sms] failed:', error);
    await db.insert(messageLog).values({ channel: 'sms', to, body, status: 'failed', error });
    return false;
  }
}

/** Verify Twilio's X-Twilio-Signature on an inbound webhook. */
export function validTwilioSignature(signature: string | null, url: string, params: Record<string, string>): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return process.env.NODE_ENV !== 'production';
  if (!signature) return false;
  return twilio.validateRequest(token, signature, url, params);
}
