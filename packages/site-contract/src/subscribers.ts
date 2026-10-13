import type { Empty, IsoDate } from './common';

/**
 * A signup. Contact details are masked ("ma•••@gmail.com", "(•••) •••-1234"),
 * the same as the website's admin list; the full list is in the CSV export.
 */
export type SubscriberDto = {
  id: string;
  emailMasked: string | null;
  phoneMasked: string | null;
  emailActive: boolean;
  smsActive: boolean;
  /** Has an email/phone but turned that channel off (unsubscribe / STOP). */
  emailOff: boolean;
  smsOff: boolean;
  source: string;
  createdAt: IsoDate;
};

export type BroadcastDto = {
  id: string;
  subject: string;
  body: string;
  sendEmail: boolean;
  sendSms: boolean;
  emailCount: number;
  smsCount: number;
  /** null while still sending */
  sentAt: IsoDate | null;
  createdAt: IsoDate;
};

export type BroadcastInput = {
  /** Required (3+ chars) when sendEmail. */
  subject: string;
  body: string;
  sendEmail: boolean;
  sendSms: boolean;
  /** An active special to attach, or '' / null for none. */
  specialId: string | null;
};

export type BroadcastPreview = {
  sms: string;
  smsChars: number;
  /** Billed SMS segments per recipient (GSM-7: 160/153, otherwise 70/67). */
  smsSegments: number;
  emailSubject: string;
  /** With a placeholder unsubscribe link. */
  emailText: string;
  emailRecipients: number;
  smsRecipients: number;
};

export type SubscribersOps = {
  /** `query` matches email or phone digits (server-side, unmasked). Newest first, max 500. */
  'subscribers.list': {
    input: { query?: string };
    output: {
      counts: { emailActive: number; smsActive: number; total: number; unsubscribed: number };
      subscribers: SubscriberDto[];
      /** Last 10 */
      broadcasts: BroadcastDto[];
      /** Active specials that can be attached to a broadcast. */
      specials: Array<{ id: string; title: string }>;
    };
  };
  /** Full, unmasked export (email, phone, consent text and dates). Formula-safe cells. */
  'subscribers.exportCsv': { input: Empty; output: { filename: string; csv: string } };
  /** The exact messages and recipient counts. Sends nothing. */
  'subscribers.previewBroadcast': { input: BroadcastInput; output: BroadcastPreview };
  /** Sends to opted-in subscribers only and records the broadcast. Can't be undone. */
  'subscribers.sendBroadcast': {
    input: BroadcastInput;
    output: { id: string; emailCount: number; smsCount: number };
  };
};
