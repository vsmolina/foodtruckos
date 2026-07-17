// Shared KDS ticket shape — published to Redis by the webhook ingest, replayed
// on connect as a snapshot, and rendered by the KDS client. One source of truth.

export type KdsTicketItem = {
  qty: number;
  name: string;
  notes: string | null;
  modifiers: string[];
};

export type KdsTicket = {
  id: string;
  orderId: string;
  /** Short display number, e.g. "#142". */
  number: string;
  state: string;
  /** Kitchen ticket start (drives the elapsed timer), ISO string. */
  startedAt: string;
  /** When the order was placed (bottom-bar time), ISO string. */
  placedAt: string;
  items: KdsTicketItem[];
};

export type KdsEventType = 'ticket:created' | 'ticket:updated' | 'ticket:removed';

export type KdsEvent = {
  type: KdsEventType;
  ticket: KdsTicket;
};

/** Socket.IO event names. */
export const SOCKET = {
  join: 'kds:join',
  snapshot: 'ticket:snapshot',
  created: 'ticket:created',
  updated: 'ticket:updated',
  removed: 'ticket:removed',
  complete: 'ticket:complete',
} as const;
