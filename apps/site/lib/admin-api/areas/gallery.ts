import 'server-only';
import type { GalleryOps } from '@barrio/site-contract';
import * as gallery from '@/lib/admin/gallery';
import { ok } from '@/lib/admin/result';
import { firstFile, type AreaHandlers } from '../define';

export const galleryHandlers: AreaHandlers<GalleryOps> = {
  'gallery.counts': async () => ok(await gallery.galleryCounts()),
  'gallery.list': (input) => gallery.galleryList(input),
  'gallery.takedowns': () => gallery.galleryTakedowns(),
  'gallery.confirmConsent': (input) => gallery.confirmConsent(input),
  'gallery.approve': (input) => gallery.approvePhoto(input),
  'gallery.reject': (input) => gallery.rejectPhoto(input),
  'gallery.remove': (input) => gallery.removePhoto(input),
  'gallery.restore': (input) => gallery.restoreToPending(input),
  'gallery.setCaption': (input) => gallery.setCaption(input),
  'gallery.upload': (input, ctx) => gallery.uploadOwnerPhoto(firstFile(ctx, 'photo'), input),
  'gallery.resolveTakedown': (input) => gallery.resolveTakedown(input),
  'gallery.dismissTakedown': (input) => gallery.dismissTakedown(input),
};
