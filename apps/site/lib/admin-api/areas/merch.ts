import 'server-only';
import type { MerchOps } from '@barrio/site-contract';
import * as merch from '@/lib/admin/merch';
import { ok } from '@/lib/admin/result';
import { firstFile, type AreaHandlers } from '../define';

export const merchHandlers: AreaHandlers<MerchOps> = {
  'merch.overview': async () => ok(await merch.merchOverview()),
  'merch.getProduct': (input) => merch.getProduct(input),
  'merch.saveProduct': (input, ctx) => merch.saveProduct(input, firstFile(ctx, 'photo')),
  'merch.setActive': (input) => merch.setProductActive(input),
  'merch.setStock': (input) => merch.setVariantStock(input),
  'merch.deleteProduct': (input) => merch.deleteProduct(input),
  'merch.listOrders': (input) => merch.listOrders(input),
  'merch.getOrder': (input) => merch.getOrder(input),
  'merch.fulfill': (input) => merch.fulfillOrder(input),
  'merch.setOrderStatus': (input) => merch.setOrderStatus(input),
};
