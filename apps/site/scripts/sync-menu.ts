import { syncMenuFromSquare } from '@/lib/square/sync';

// pnpm --filter site square:sync-menu — same as the admin's "Sync from Square".
syncMenuFromSquare()
  .then((r) => {
    console.info(`[sync] ${r.categories} categories, ${r.items} items, ${r.removed} hidden`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('[sync] failed:', err);
    process.exit(1);
  });
