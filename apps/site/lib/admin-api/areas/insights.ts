import 'server-only';
import type { InsightsOps } from '@barrio/site-contract';
import * as insights from '@/lib/admin/insights';
import { ok } from '@/lib/admin/result';
import type { AreaHandlers } from '../define';

export const insightsHandlers: AreaHandlers<InsightsOps> = {
  'insights.orders': async () => ok(await insights.tonightsOrders()),
  'insights.setOrderStatus': (input) => insights.overrideOrderStatus(input),
  'insights.analytics': (input) => insights.analytics(input),
  'insights.today': async () => ok(await insights.today()),
};
