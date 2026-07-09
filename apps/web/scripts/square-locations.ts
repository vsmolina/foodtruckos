import { listLocations } from '@/lib/square/client';

/**
 * Print the merchant's Square locations so you can fill SQUARE_LOCATION_ID.
 * Needs SQUARE_ACCESS_TOKEN and SQUARE_ENVIRONMENT in the environment.
 *
 *   pnpm --filter web exec tsx scripts/square-locations.ts
 */
async function main(): Promise<void> {
  const locations = await listLocations();
  if (locations.length === 0) {
    console.info('No locations returned. Check SQUARE_ACCESS_TOKEN / SQUARE_ENVIRONMENT.');
    return;
  }
  for (const loc of locations) {
    console.info(`${loc.id}\t${loc.name ?? '(unnamed)'}\t${loc.status ?? ''}`);
  }
  console.info(`\nPut one of the ids above into SQUARE_LOCATION_ID in .env`);
}

main().catch((err) => {
  console.error('[square-locations] failed:', err);
  process.exit(1);
});
