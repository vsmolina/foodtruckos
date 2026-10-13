import type { Empty, ImageUrl, IsoDate } from './common';

export type PartnerKind = 'bar' | 'bartender' | 'other';

/** Scans in the last 30 days; paid web orders credited all-time. */
export type PartnerStatsDto = { visits30: number; orders: number; revenueCents: number };

export type PartnerDto = {
  id: string;
  name: string;
  kind: PartnerKind;
  blurb: string | null;
  photoUrl: ImageUrl | null;
  instagram: string | null;
  url: string | null;
  /** Upper-case referral code: /r/CODE */
  code: string;
  /** Absolute referral link, e.g. https://barrioburger.co/r/HARPERS */
  referralUrl: string;
  active: boolean;
  sortOrder: number;
  createdAt: IsoDate;
  stats: PartnerStatsDto;
};

export type PartnerInput = {
  name: string;
  kind: PartnerKind;
  /** 3–16 letters/numbers; upper-cased by the site. */
  code: string;
  blurb: string;
  instagram: string;
  /** Blank, or starts with http(s):// */
  url: string;
  sortOrder: number;
  active: boolean;
};

export type PartnersOps = {
  'partners.list': { input: Empty; output: { partners: PartnerDto[]; totals: PartnerStatsDto } };
  'partners.get': { input: { id: string }; output: PartnerDto };
  /**
   * Create (`id: null`) or update. Multipart: optional file part `photo`
   * replaces the photo. Field errors keyed by input name (and `photo`).
   */
  'partners.save': { input: PartnerInput & { id: string | null }; output: PartnerDto };
  'partners.removePhoto': { input: { id: string }; output: PartnerDto };
  /** Deletes the partner and its scan history; credited orders keep no partner. Prefer deactivating. */
  'partners.delete': { input: { id: string }; output: { deleted: true } };
  /** Printable QR: SVG markup (black on white) for the referral link. */
  'partners.qr': { input: { id: string }; output: { partner: PartnerDto; svg: string; referralUrl: string } };
};
