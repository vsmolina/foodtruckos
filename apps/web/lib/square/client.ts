import { SquareClient, SquareEnvironment } from 'square';
import type * as Square from 'square';
import { makeMockOrder } from './mock';

// Single-merchant client built from a personal access token. No JWT/RSA/token
// exchange — see docs/02-BUILD-SPEC.md Phase 2.
let cached: SquareClient | null = null;

function environment(): string {
  return process.env.SQUARE_ENVIRONMENT === 'production'
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;
}

export function squareClient(): SquareClient {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error('SQUARE_ACCESS_TOKEN is not set');
  cached ??= new SquareClient({ token, environment: environment() });
  return cached;
}

// Every external call has a 5s timeout (ground rule).
const REQUEST_OPTIONS = { timeoutInSeconds: 5 } as const;

/** Offline mode for local E2E: skip Square and hydrate from a fixture. */
function isMock(): boolean {
  return process.env.SQUARE_MOCK === '1';
}

/** Hydrate a full order. `order.*` webhooks are thin; this is the fat call. */
export async function retrieveOrder(orderId: string): Promise<Square.Order> {
  if (isMock()) {
    return makeMockOrder(orderId, process.env.SQUARE_LOCATION_ID ?? 'MOCK_LOCATION');
  }
  const res = await squareClient().orders.get({ orderId }, REQUEST_OPTIONS);
  if (!res.order) throw new Error(`Square returned no order for ${orderId}`);
  return res.order;
}

/** Search orders for a location (Square's replacement for a flat "list"). */
export async function searchOrders(
  locationId: string,
  opts: { limit?: number; cursor?: string } = {},
): Promise<Square.Order[]> {
  const res = await squareClient().orders.search(
    {
      locationIds: [locationId],
      ...(opts.limit != null ? { limit: opts.limit } : {}),
      ...(opts.cursor != null ? { cursor: opts.cursor } : {}),
    },
    REQUEST_OPTIONS,
  );
  return res.orders ?? [];
}

/** Push a fulfillment state change back to Square (used in later phases). */
export async function updateOrderFulfillment(
  orderId: string,
  version: number,
  state: string,
): Promise<Square.Order> {
  const res = await squareClient().orders.update(
    {
      orderId,
      order: {
        locationId: process.env.SQUARE_LOCATION_ID ?? '',
        version,
        fulfillments: [{ state: state as Square.FulfillmentState }],
      },
      idempotencyKey: `fulfillment-${orderId}-${version}-${state}`,
    },
    REQUEST_OPTIONS,
  );
  if (!res.order) throw new Error(`Square returned no order for ${orderId}`);
  return res.order;
}

/** List the merchant's locations — used to discover SQUARE_LOCATION_ID. */
export async function listLocations(): Promise<Square.Location[]> {
  const res = await squareClient().locations.list(REQUEST_OPTIONS);
  return res.locations ?? [];
}
