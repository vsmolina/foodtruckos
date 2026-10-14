import 'server-only';
import type { StatusOps } from '@barrio/site-contract';
import * as status from '@/lib/admin/status';
import { ok } from '@/lib/admin/result';
import type { AreaHandlers } from '../define';

export const statusHandlers: AreaHandlers<StatusOps> = {
  'status.get': async () => ok(await status.statusOverview()),
  'status.set': (input) => status.setStatus(input),
  'status.setPaused': (input) => status.setOrderingPaused(input),
  'status.saveMessages': (input) => status.saveMessages(input),
  'status.saveLocation': (input) => status.saveLocation(input),
  'status.saveHours': (input) => status.saveHours(input),
};
