// Presentation helpers. Money is integer cents everywhere in the domain; format
// only at the edge (never do math on formatted strings).

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** 1234 → "$12.34". */
export function money(cents: number): string {
  return USD.format(cents / 100);
}

/** Seconds → "M:SS" (or "H:MM:SS" past an hour). null → "—". */
export function duration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${pad(sec)}` : `${mm}:${pad(sec)}`;
}

/** Short order label from the Square order id — "#A1B2" — falling back to a
 *  slice of our uuid when there's no Square id. */
export function orderNumber(squareOrderId: string | null, id: string): string {
  const src = squareOrderId ?? id;
  return `#${src.slice(-4).toUpperCase()}`;
}

/** Wall-clock time in the given timezone, e.g. "1:07 PM". */
export function clockTime(iso: string, timeZone = 'America/Chicago'): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}
