// Presentation helpers. Money is integer cents everywhere; format only at the edge.

export const TIMEZONE = 'America/Chicago';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** 1234 → "$12.34". */
export function money(cents: number): string {
  return USD.format(cents / 100);
}

/** 1200 → "$12", 1249 → "$12.49" — menu style, no needless ".00". */
export function price(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : money(cents);
}

/** "20:30" → "8:30 PM". */
export function hhmm(value: string | null | undefined): string {
  if (!value) return '';
  const [h = 0, m = 0] = value.split(':').map(Number);
  const suffix = h >= 12 && h < 24 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function clockTime(at: Date | string): string {
  return new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TIMEZONE });
}

export function dateTime(at: Date | string): string {
  return new Date(at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TIMEZONE,
  });
}

export function shortDate(at: Date | string): string {
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TIMEZONE });
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const DAY_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;

/** US phone input → E.164 (+15125550123), or null. */
export function toE164(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/** +15125550123 → "(512) 555-0123". */
export function prettyPhone(e164: string): string {
  const d = e164.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : e164;
}

/** "2026-10-16T20:30" read as America/Chicago wall time → Date. */
export function fromLocalInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Offset of Chicago at that instant (handles DST), found by formatting.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(asUtc));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const shown = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return new Date(asUtc + (asUtc - shown));
}

/** Date → "YYYY-MM-DDTHH:mm" in Chicago time, for <input type="datetime-local">. */
export function toLocalInput(at: Date | null | undefined): string {
  if (!at) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
