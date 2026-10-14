import 'server-only';
import QRCode from 'qrcode';
import { env } from '@/lib/env';

export function referralUrl(code: string): string {
  return `${env.siteUrl}/r/${code}`;
}

/** QR code for a partner's referral link, as an SVG string (black on white, error level M). */
export async function referralQrSvg(code: string): Promise<string> {
  return QRCode.toString(referralUrl(code), { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#14110E', light: '#FFFFFF' } });
}
