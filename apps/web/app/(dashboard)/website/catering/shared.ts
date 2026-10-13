import type { CateringStage } from '@barrio/site-contract';

export const STAGES: readonly CateringStage[] = ['new', 'contacted', 'quoted', 'booked', 'declined'];

export const STAGE_LABEL: Record<CateringStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  quoted: 'Quoted',
  booked: 'Booked',
  declined: 'Declined',
};

export const STAGE_TONE: Record<CateringStage, 'warn' | 'accent' | 'neutral' | 'ok'> = {
  new: 'warn',
  contacted: 'accent',
  quoted: 'accent',
  booked: 'ok',
  declined: 'neutral',
};

export const isStage = (v: unknown): v is CateringStage => typeof v === 'string' && (STAGES as readonly string[]).includes(v);

/** "2026-10-27" → "Tue, Oct 27" (a calendar date, so no timezone shift). */
export function eventDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** "19:00" → "7:00 PM". */
export function hhmm(value: string): string {
  const [h, m] = value.split(':').map(Number);
  if (h == null || m == null || Number.isNaN(h)) return value;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "+15125550142" → "(512) 555-0142". */
export function prettyPhone(e164: string): string {
  const d = e164.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : e164;
}
