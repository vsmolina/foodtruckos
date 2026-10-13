// Contract for the website's admin API: POST {SITE_URL}/api/admin/v1/<op>.
// apps/site implements every op (lib/admin-api/registry.ts must satisfy
// `SiteOps`), apps/web calls them (lib/site/api.ts). Types only — always
// `import type`, so nothing from here exists at runtime and neither app needs to
// transpile this package. Change an op here and both apps' typecheck follows.

import type { StatusOps } from './status';
import type { MenuOps } from './menu';
import type { SpecialsOps } from './specials';
import type { MerchOps } from './merch';
import type { GalleryOps } from './gallery';
import type { PartnersOps } from './partners';
import type { CateringOps } from './catering';
import type { SubscribersOps } from './subscribers';
import type { InsightsOps } from './insights';

export type * from './common';
export type * from './status';
export type * from './menu';
export type * from './specials';
export type * from './merch';
export type * from './gallery';
export type * from './partners';
export type * from './catering';
export type * from './subscribers';
export type * from './insights';

/** Every op: `{ input, output }`. Op names are `<area>.<verb>`. */
export type SiteOps = StatusOps &
  MenuOps &
  SpecialsOps &
  MerchOps &
  GalleryOps &
  PartnersOps &
  CateringOps &
  SubscribersOps &
  InsightsOps;

export type SiteOpName = keyof SiteOps & string;
export type SiteOpInput<K extends SiteOpName> = SiteOps[K]['input'];
export type SiteOpOutput<K extends SiteOpName> = SiteOps[K]['output'];
