import type { Empty, IsoDate } from './common';

export type TruckStatus = 'open' | 'closed' | 'back_soon';

export type SiteSettingsDto = {
  status: TruckStatus;
  statusMessage: string | null;
  orderingPaused: boolean;
  pausedMessage: string | null;
  defaultWaitMinutes: number;
  locationName: string;
  address: string;
  lat: string;
  lng: string;
  lateNightNote: string | null;
  phone: string | null;
  instagram: string;
  updatedAt: IsoDate;
};

export type DayHoursDto = {
  /** 0 = Sunday */
  dayOfWeek: number;
  /** "20:30"; null when closed */
  opens: string | null;
  /** may be past midnight, e.g. "03:00" */
  closes: string | null;
  closed: boolean;
  note: string | null;
};

export type StatusOverview = {
  settings: SiteSettingsDto;
  hours: DayHoursDto[];
  /** What a customer sees right now. */
  ordering: { canOrder: true; waitMinutes: number } | { canOrder: false; reason: 'closed' | 'back_soon' | 'paused'; message: string | null };
};

export type StatusOps = {
  'status.get': { input: Empty; output: StatusOverview };
  'status.set': { input: { status: TruckStatus }; output: StatusOverview };
  'status.setPaused': { input: { paused: boolean }; output: StatusOverview };
  'status.saveMessages': {
    input: { statusMessage: string; pausedMessage: string; defaultWaitMinutes: number };
    output: StatusOverview;
  };
  'status.saveLocation': {
    input: {
      locationName: string;
      address: string;
      lat: string;
      lng: string;
      lateNightNote: string;
      phone: string;
      instagram: string;
    };
    output: StatusOverview;
  };
  /** All 7 days; field errors are keyed `day-<n>`. */
  'status.saveHours': {
    input: { days: Array<{ dayOfWeek: number; closed: boolean; opens: string; closes: string; note: string }> };
    output: StatusOverview;
  };
};
