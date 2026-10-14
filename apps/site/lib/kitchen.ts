import 'server-only';

// Current kitchen load, read from the truck's foodtruck-os over the tunnel
// (GET {KITCHEN_API_URL}/api/public/kitchen). The truck's PC can be off or
// offline, so this is best-effort: 1.5 s timeout, 30 s memo, fallback to the
// admin's default wait.

type Load = { activeTickets: number; avgTicketSeconds: number | null };

let memo: { at: number; load: Load | null } | null = null;

export async function kitchenLoad(): Promise<Load | null> {
  const base = process.env.KITCHEN_API_URL;
  if (!base) return null;
  if (memo && Date.now() - memo.at < 30_000) return memo.load;
  let load: Load | null = null;
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/public/kitchen`, {
      headers: process.env.KITCHEN_API_TOKEN ? { authorization: `Bearer ${process.env.KITCHEN_API_TOKEN}` } : {},
      signal: AbortSignal.timeout(1500),
      cache: 'no-store',
    });
    if (res.ok) load = (await res.json()) as Load;
  } catch {
    load = null;
  }
  memo = { at: Date.now(), load };
  return load;
}

/**
 * Estimated minutes until a new order is ready: the base prep time plus a share
 * of the queue ahead of it. The grill works ~3 tickets at once.
 */
export async function estimateWaitMinutes(defaultMinutes: number): Promise<number> {
  const load = await kitchenLoad();
  if (!load) return defaultMinutes;
  const perTicket = Math.max(3, Math.min(12, (load.avgTicketSeconds ?? defaultMinutes * 60) / 60));
  const wait = perTicket + (load.activeTickets / 3) * perTicket;
  return Math.max(5, Math.min(60, Math.round(wait)));
}
