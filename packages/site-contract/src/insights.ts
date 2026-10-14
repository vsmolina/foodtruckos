import type { Empty, IsoDate } from './common';
import type { CateringStage } from './catering';
import type { TruckStatus } from './status';

export type WebOrderState = 'pending_payment' | 'received' | 'preparing' | 'ready' | 'picked_up' | 'cancelled' | 'failed';

/** Statuses the owner may set by hand (when the KDS link is down, or in test mode). */
export type WebOrderOverride = 'preparing' | 'ready' | 'picked_up' | 'cancelled';

export type WebOrderDto = {
  id: string;
  code: string;
  status: WebOrderState;
  customerName: string;
  phoneLast4: string;
  smsOptIn: boolean;
  readySmsSent: boolean;
  lines: Array<{ qty: number; itemName: string; variationName: string; modifiers: string[]; note: string | null }>;
  totalCents: number;
  error: string | null;
  createdAt: IsoDate;
};

/** day: 1 = Mon … 7 = Sun, the night it started (a night runs 5 AM → 5 AM); hour 0–23 local. */
export type HeatCell = { day: number; hour: number; n: number };

/** Thursday & Friday 8–10 PM vs an average 2-night × 2-hour block (6 PM–5 AM). */
export type WatchSummary = { window: number; avgSlot: number; share: number; total: number };

export type ReferralPerformance = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  visits: number;
  orders: number;
  revenueCents: number;
};

export type AnalyticsDto = {
  days: 7 | 30 | 90;
  totals: { views: number; orders: number; revenueCents: number; merchCents: number; merchOrders: number };
  visitHeat: HeatCell[];
  orderHeat: HeatCell[];
  watch: { visits: WatchSummary; orders: WatchSummary };
  topPages: Array<{ label: string; n: number }>;
  topReferrers: Array<{ label: string; n: number }>;
  partners: ReferralPerformance[];
  /** All time */
  pipeline: Record<CateringStage, number>;
};

/** One call for the dashboard's Today card. "Tonight" = since 5 AM local. */
export type WebsiteToday = {
  status: TruckStatus;
  statusMessage: string | null;
  orderingPaused: boolean;
  pausedMessage: string | null;
  ordersTonight: number;
  revenueTonightCents: number;
  newLeads: number;
  /** new + contacted + quoted */
  openLeads: number;
  photosPending: number;
  takedownsOpen: number;
  merchToShip: number;
};

export type InsightsOps = {
  /** Tonight's web orders (last 16 h), newest first. */
  'insights.orders': {
    input: Empty;
    output: { orders: WebOrderDto[]; paidCount: number; paidTotalCents: number; testMode: boolean };
  };
  /** Manual override. "ready" texts the customer once (if they opted in). Doesn't refund. */
  'insights.setOrderStatus': { input: { id: string; status: WebOrderOverride }; output: WebOrderDto };
  'insights.analytics': { input: { days: 7 | 30 | 90 }; output: AnalyticsDto };
  'insights.today': { input: Empty; output: WebsiteToday };
};
