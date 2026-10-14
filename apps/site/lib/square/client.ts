import 'server-only';
import { SquareClient, SquareEnvironment } from 'square';

// Same single-merchant Square account as foodtruck-os (personal access token).
let cached: SquareClient | null = null;

export function squareClient(): SquareClient {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error('SQUARE_ACCESS_TOKEN is not set');
  cached ??= new SquareClient({
    token,
    environment: process.env.SQUARE_ENVIRONMENT === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  });
  return cached;
}

export function squareLocationId(): string {
  const id = process.env.SQUARE_LOCATION_ID;
  if (!id) throw new Error('SQUARE_LOCATION_ID is not set');
  return id;
}

/** Every Square call has a timeout. */
export const SQ = { timeoutInSeconds: 8 } as const;
