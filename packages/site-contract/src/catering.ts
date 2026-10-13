import type { IsoDate } from './common';

export type CateringStage = 'new' | 'contacted' | 'quoted' | 'booked' | 'declined';

/** One row in the pipeline list. Option values come with display labels. */
export type CateringLeadSummary = {
  id: string;
  status: CateringStage;
  name: string;
  /** YYYY-MM-DD, the event's local date */
  eventDate: string;
  /** HH:MM, 24-hour */
  startTime: string;
  guestCount: number;
  eventTypeLabel: string;
  createdAt: IsoDate;
};

export type CateringLeadDto = CateringLeadSummary & {
  /** E.164 */
  phone: string;
  email: string;
  durationLabel: string;
  location: string;
  serviceStyleLabel: string;
  menuInterestLabels: string[];
  budgetLabel: string | null;
  notes: string | null;
  /** Private; only the owner sees these. */
  adminNotes: string | null;
  updatedAt: IsoDate;
};

export type CateringOps = {
  /** Newest first, max 200. `stage` null/absent = all stages. */
  'catering.list': {
    input: { stage?: CateringStage | null };
    output: { counts: Record<CateringStage, number>; total: number; leads: CateringLeadSummary[] };
  };
  'catering.get': { input: { id: string }; output: CateringLeadDto };
  /** Move a lead through the pipeline; `adminNotes` omitted = unchanged, '' = cleared. */
  'catering.update': {
    input: { id: string; status: CateringStage; adminNotes?: string };
    output: CateringLeadDto;
  };
};
