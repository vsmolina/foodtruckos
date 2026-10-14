// Which integrations are configured. Every external service is optional in
// development: without keys, SMS/email are written to message_log and the
// console, uploads go to public/uploads, and payments run in mock mode.

export const env = {
  siteUrl: (process.env.SITE_URL ?? 'http://localhost:3020').replace(/\/$/, ''),
  isProd: process.env.NODE_ENV === 'production',
};

export const has = {
  square: Boolean(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID && process.env.SQUARE_APPLICATION_ID),
  stripe: Boolean(process.env.STRIPE_SECRET_KEY),
  twilio: Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER),
  ),
  resend: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
};

/**
 * Mock payments: orders are accepted without charging a card. Only ever in
 * development, and only when Square isn't configured or PAYMENTS_MOCK=1.
 */
export function paymentsMock(): boolean {
  if (env.isProd) return false;
  return process.env.PAYMENTS_MOCK === '1' || !has.square;
}
