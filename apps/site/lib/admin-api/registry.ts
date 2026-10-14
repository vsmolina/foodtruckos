import 'server-only';
import type { SiteOpName } from '@barrio/site-contract';
import type { OpHandler } from './define';
import { cateringHandlers } from './areas/catering';
import { galleryHandlers } from './areas/gallery';
import { insightsHandlers } from './areas/insights';
import { menuHandlers } from './areas/menu';
import { merchHandlers } from './areas/merch';
import { partnersHandlers } from './areas/partners';
import { specialsHandlers } from './areas/specials';
import { statusHandlers } from './areas/status';
import { subscribersHandlers } from './areas/subscribers';

/** Every contract op must be here — typecheck fails if one is missing. */
export const handlers: { [K in SiteOpName]: OpHandler<K> } = {
  ...statusHandlers,
  ...menuHandlers,
  ...specialsHandlers,
  ...merchHandlers,
  ...galleryHandlers,
  ...partnersHandlers,
  ...cateringHandlers,
  ...subscribersHandlers,
  ...insightsHandlers,
};

export function isOp(name: string): name is SiteOpName {
  return Object.hasOwn(handlers, name);
}
