import 'server-only';
import type { SubscribersOps } from '@barrio/site-contract';
import * as subs from '@/lib/admin/subscribers';
import { ok } from '@/lib/admin/result';
import type { AreaHandlers } from '../define';

export const subscribersHandlers: AreaHandlers<SubscribersOps> = {
  'subscribers.list': (input) => subs.listSubscribers(input),
  'subscribers.exportCsv': async () => ok(await subs.subscribersCsv()),
  'subscribers.previewBroadcast': (input) => subs.previewBroadcast(input),
  'subscribers.sendBroadcast': (input) => subs.sendBroadcast(input),
};
