import { Queue, UnrecoverableError, Worker, type Job } from 'bullmq';
import { eq, inArray } from 'drizzle-orm';
import Redis from 'ioredis';
import { db } from '@/lib/db/client';
import { menuCategories, menuItems } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import {
  deleteCatalogObjects,
  deleteUnusedLists,
  PullRequiredError,
  pushCategory,
  pushItem,
  squareErrorMessage,
} from '@/lib/square/menu';

// BullMQ queue for menu → Square Catalog sync (Phase 5). Admin saves enqueue a
// job; the worker (started in server.ts) pushes and stores the returned ids
// and versions. Failures retry with exponential backoff; the item/category row
// carries the status the admin badge shows.

const QUEUE = 'square-sync';
// 6 attempts: 2s, 4s, 8s, 16s, 32s between them — about a minute in total.
const ATTEMPTS = 6;

export type SyncJob =
  | { kind: 'item'; itemId: string }
  | { kind: 'category'; categoryId: string }
  | { kind: 'delete'; objectIds: string[]; modifierListIds: string[] };

const JOB_NAME: Record<SyncJob['kind'], string> = {
  item: 'square.sync.item',
  category: 'square.sync.category',
  delete: 'square.sync.delete',
};

/** Sync is off in offline mock mode or without Square credentials. */
export function syncEnabled(): boolean {
  return process.env.SQUARE_MOCK !== '1' && Boolean(process.env.SQUARE_ACCESS_TOKEN);
}

// BullMQ needs its own connections with maxRetriesPerRequest: null.
const connection = () =>
  new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });

const globalForQueue = globalThis as unknown as { squareSyncQueue?: Queue<SyncJob> };
function queue(): Queue<SyncJob> {
  globalForQueue.squareSyncQueue ??= new Queue<SyncJob>(QUEUE, { connection: connection() });
  return globalForQueue.squareSyncQueue;
}

async function add(job: SyncJob): Promise<void> {
  await queue().add(JOB_NAME[job.kind], job, {
    attempts: ATTEMPTS,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}

/** Mark an item pending and queue its push. No-op when sync is disabled. */
export async function enqueueItemSync(itemId: string): Promise<void> {
  if (!syncEnabled()) return;
  await db.update(menuItems).set({ syncStatus: 'pending', syncError: null }).where(eq(menuItems.id, itemId));
  await add({ kind: 'item', itemId });
}

export async function enqueueCategorySync(categoryId: string): Promise<void> {
  if (!syncEnabled()) return;
  await db
    .update(menuCategories)
    .set({ syncStatus: 'pending', syncError: null })
    .where(eq(menuCategories.id, categoryId));
  await add({ kind: 'category', categoryId });
}

/** Queue deletion of Square objects whose local rows are already gone. */
export async function enqueueDelete(objectIds: string[], modifierListIds: string[] = []): Promise<void> {
  if (!syncEnabled() || (objectIds.length === 0 && modifierListIds.length === 0)) return;
  await add({ kind: 'delete', objectIds, modifierListIds });
}

/** Queue every item and category that isn't synced (initial push, or retrying errors). */
export async function enqueueAllUnsynced(): Promise<number> {
  if (!syncEnabled()) return 0;
  const cats = await db
    .select({ id: menuCategories.id })
    .from(menuCategories)
    .where(inArray(menuCategories.syncStatus, ['local', 'error']));
  const items = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(inArray(menuItems.syncStatus, ['local', 'error']));
  // Categories first: items reference them (pushItem also creates a missing one).
  for (const c of cats) await enqueueCategorySync(c.id);
  for (const i of items) await enqueueItemSync(i.id);
  return cats.length + items.length;
}

async function setStatus(job: SyncJob, status: 'pending' | 'error', message: string): Promise<void> {
  if (job.kind === 'item') {
    await db.update(menuItems).set({ syncStatus: status, syncError: message }).where(eq(menuItems.id, job.itemId));
  } else if (job.kind === 'category') {
    await db
      .update(menuCategories)
      .set({ syncStatus: status, syncError: message })
      .where(eq(menuCategories.id, job.categoryId));
  }
}

async function runJob(job: Job<SyncJob>): Promise<void> {
  const data = job.data;
  try {
    if (data.kind === 'item') await pushItem(data.itemId);
    else if (data.kind === 'category') await pushCategory(data.categoryId);
    else {
      await deleteCatalogObjects(data.objectIds);
      if (data.modifierListIds.length) await deleteUnusedLists(data.modifierListIds);
    }
  } catch (err) {
    // Retrying can't fix a missing pull; stop immediately with a clear message.
    if (err instanceof PullRequiredError) throw new UnrecoverableError(err.message);
    throw err;
  }
}

/** Start the single sync worker. Concurrency 1 keeps pushes for an item in order. */
export function startSquareSyncWorker(): Worker<SyncJob> {
  const worker = new Worker<SyncJob>(QUEUE, runJob, { connection: connection(), concurrency: 1 });

  worker.on('failed', (job, err) => {
    if (!job) return;
    const message = squareErrorMessage(err);
    const final = err instanceof UnrecoverableError || job.attemptsMade >= (job.opts.attempts ?? 1);
    logger.warn({ job: job.name, data: job.data, attempt: job.attemptsMade, final, err: message }, 'square sync failed');
    // While retries remain the row stays 'pending' but carries the latest error.
    setStatus(job.data, final ? 'error' : 'pending', message).catch((e: unknown) =>
      logger.error({ err: String(e) }, 'could not record sync failure'),
    );
  });
  worker.on('completed', (job) => logger.info({ job: job.name, data: job.data }, 'square sync done'));
  return worker;
}

/** Close the queue's connection (graceful shutdown). */
export async function closeSquareSyncQueue(): Promise<void> {
  await globalForQueue.squareSyncQueue?.close();
}
