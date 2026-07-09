import { WebhooksHelper } from 'square';

/** The header Square signs its webhook payloads with. */
export const SIGNATURE_HEADER = 'x-square-hmacsha256-signature';

/**
 * Verify a Square webhook signature. Square signs HMAC-SHA256 over
 * `notificationUrl + rawBody`. `notificationUrl` must EXACTLY match the URL
 * configured in the subscription. Returns false on any failure (never throws).
 */
export async function verifySignature(params: {
  requestBody: string;
  signatureHeader: string | null;
  notificationUrl: string;
  signatureKey: string;
}): Promise<boolean> {
  const { requestBody, signatureHeader, notificationUrl, signatureKey } = params;
  if (!signatureHeader || !signatureKey || !notificationUrl) return false;
  try {
    return await WebhooksHelper.verifySignature({
      requestBody,
      signatureHeader,
      signatureKey,
      notificationUrl,
    });
  } catch {
    return false;
  }
}
