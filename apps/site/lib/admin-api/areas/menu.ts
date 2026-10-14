import 'server-only';
import type { MenuOps } from '@barrio/site-contract';
import * as menu from '@/lib/admin/menu';
import { ok } from '@/lib/admin/result';
import { firstFile, type AreaHandlers } from '../define';

export const menuHandlers: AreaHandlers<MenuOps> = {
  'menu.list': async () => ok(await menu.menuOverview()),
  'menu.sync': () => menu.syncMenu(),
  'menu.setItemFlag': (input) => menu.setItemFlag(input),
  'menu.saveItem': (input, ctx) => menu.saveItem(input, firstFile(ctx, 'photo')),
  'menu.saveCategory': (input) => menu.saveCategory(input),
  'menu.setCategoryHidden': (input) => menu.setCategoryHidden(input),
};
