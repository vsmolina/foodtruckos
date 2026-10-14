import 'server-only';
import type { SpecialsOps } from '@barrio/site-contract';
import { ok } from '@/lib/admin/result';
import * as specials from '@/lib/admin/specials';
import { firstFile, type AreaHandlers } from '../define';

export const specialsHandlers: AreaHandlers<SpecialsOps> = {
  'specials.list': async () => ok({ specials: await specials.listSpecials() }),
  'specials.get': (input) => specials.getSpecial(input),
  'specials.save': (input, ctx) => specials.saveSpecial(input, firstFile(ctx, 'photo')),
  'specials.setActive': (input) => specials.setSpecialActive(input),
  'specials.delete': (input) => specials.deleteSpecial(input),
};
