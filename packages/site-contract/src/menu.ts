import type { Empty, ImageUrl, IsoDate } from './common';

// Website-only menu fields. Names, descriptions, prices and sizes come from
// Square (the dashboard's Menu pushes there); the website caches the catalog
// and adds these on top.

export type MenuItemFlag = 'soldOut' | 'hidden' | 'isNew';

export type MenuItemDto = {
  id: string;
  /** Square catalog item id; null for sample items never seen in Square. */
  squareId: string | null;
  name: string;
  description: string | null;
  taglineEs: string | null;
  /** What the website shows: the override if set, else the Square photo. */
  photoUrl: ImageUrl | null;
  squarePhotoUrl: ImageUrl | null;
  photoOverrideUrl: ImageUrl | null;
  /** Website's own sold-out toggle. */
  soldOut: boolean;
  /** Sold out at the location in Square (read on sync, not editable here). */
  squareSoldOut: boolean;
  hidden: boolean;
  isNew: boolean;
  sortOrder: number;
  prices: Array<{ name: string; priceCents: number }>;
};

export type MenuCategoryDto = {
  id: string;
  squareId: string | null;
  name: string;
  labelEs: string | null;
  sortOrder: number;
  hidden: boolean;
  items: MenuItemDto[];
};

export type MenuOverview = {
  categories: MenuCategoryDto[];
  /** Items whose category is gone. */
  uncategorized: MenuItemDto[];
  lastSyncedAt: IsoDate | null;
  /** Whether the website can reach Square (sync is possible). */
  squareConfigured: boolean;
};

export type MenuSyncResult = { categories: number; items: number; removed: number };

export type MenuOps = {
  'menu.list': { input: Empty; output: MenuOverview };
  /** Pull the Square catalog into the website now. */
  'menu.sync': { input: Empty; output: MenuSyncResult };
  'menu.setItemFlag': { input: { id: string; flag: MenuItemFlag; value: boolean }; output: { id: string } };
  /** Multipart when replacing the photo: file part `photo` (JPG/PNG/WebP, ≤ 8 MB). */
  'menu.saveItem': {
    input: { id: string; taglineEs: string; sortOrder: number; removePhoto: boolean };
    output: { id: string };
  };
  'menu.saveCategory': { input: { id: string; labelEs: string; sortOrder: number }; output: { id: string } };
  'menu.setCategoryHidden': { input: { id: string; hidden: boolean }; output: { id: string } };
};
