import 'server-only';
import type { CateringOps } from '@barrio/site-contract';
import * as catering from '@/lib/admin/catering';
import type { AreaHandlers } from '../define';

export const cateringHandlers: AreaHandlers<CateringOps> = {
  'catering.list': (input) => catering.listLeads(input),
  'catering.get': (input) => catering.getLead(input),
  'catering.update': (input) => catering.updateLead(input),
};
