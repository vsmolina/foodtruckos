import type { Empty, ImageUrl, IsoDate } from './common';

export type SpecialState = 'live' | 'scheduled' | 'ended' | 'off';

export type SpecialDto = {
  id: string;
  title: string;
  /** Spanish sticker, e.g. "¡Nuevo!". */
  kicker: string | null;
  body: string | null;
  priceLabel: string | null;
  photoUrl: ImageUrl | null;
  startsAt: IsoDate | null;
  endsAt: IsoDate | null;
  /** Same times as `datetime-local` values in the truck's timezone (America/Chicago); "" when unset. */
  startsAtLocal: string;
  endsAtLocal: string;
  active: boolean;
  sortOrder: number;
  state: SpecialState;
};

export type SpecialsOps = {
  'specials.list': { input: Empty; output: { specials: SpecialDto[] } };
  'specials.get': { input: { id: string }; output: SpecialDto };
  /**
   * Create (`id: null`) or update. Times are `datetime-local` strings in
   * America/Chicago ("2026-10-16T20:30"), "" for none. Multipart with file part
   * `photo` to set the photo.
   */
  'specials.save': {
    input: {
      id: string | null;
      title: string;
      kicker: string;
      body: string;
      priceLabel: string;
      startsAt: string;
      endsAt: string;
      sortOrder: number;
      active: boolean;
      removePhoto: boolean;
    };
    output: SpecialDto;
  };
  'specials.setActive': { input: { id: string; active: boolean }; output: SpecialDto };
  'specials.delete': { input: { id: string }; output: { id: string } };
};
