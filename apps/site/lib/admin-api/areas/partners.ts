import 'server-only';
import type { PartnersOps } from '@barrio/site-contract';
import * as partners from '@/lib/admin/partners';
import { ok } from '@/lib/admin/result';
import { firstFile, type AreaHandlers } from '../define';

export const partnersHandlers: AreaHandlers<PartnersOps> = {
  'partners.list': async () => ok(await partners.listPartners()),
  'partners.get': (input) => partners.getPartner(input),
  'partners.save': (input, ctx) => partners.savePartner(input, firstFile(ctx, 'photo')),
  'partners.removePhoto': (input) => partners.removePartnerPhoto(input),
  'partners.delete': (input) => partners.deletePartner(input),
  'partners.qr': (input) => partners.partnerQr(input),
};
