import type { Empty, ImageUrl, IsoDate } from './common';

export type GalleryPhotoStatus = 'pending' | 'approved' | 'rejected' | 'removed';

export type GalleryPhotoDto = {
  id: string;
  url: ImageUrl;
  width: number | null;
  height: number | null;
  caption: string | null;
  /** owner = uploaded from an admin; submission = sent in by a customer. */
  source: 'owner' | 'submission';
  status: GalleryPhotoStatus;
  submitterName: string | null;
  submitterEmail: string | null;
  submitterInstagram: string | null;
  /** Everyone identifiable agreed to be published. Required before approving. */
  consentConfirmed: boolean;
  /** "submitter" or "admin". */
  consentBy: string | null;
  consentAt: IsoDate | null;
  reviewedAt: IsoDate | null;
  createdAt: IsoDate;
};

export type TakedownDto = {
  id: string;
  name: string;
  email: string;
  description: string | null;
  reason: string | null;
  createdAt: IsoDate;
  /** The photo the request points at, when linked. */
  photo: GalleryPhotoDto | null;
};

/** `removed` counts removed and rejected photos; `takedowns` counts open requests. */
export type GalleryCounts = { pending: number; approved: number; removed: number; takedowns: number };

/** removed = removed + rejected. */
export type GalleryView = 'pending' | 'approved' | 'removed';

/** One of the latest posts from the connected Instagram account (shown as Instagram's own embed). */
export type InstagramPostDto = {
  id: string;
  /** Opens the post on Instagram. */
  permalink: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  postedAt: IsoDate;
};

/** The access token itself never leaves the website. */
export type InstagramStatusDto =
  | { connected: false }
  | {
      connected: true;
      username: string;
      connectedAt: IsoDate;
      /** The token renews itself weekly; this only matters if renewals keep failing. */
      tokenExpiresAt: IsoDate | null;
      lastFetchedAt: IsoDate | null;
      /** Last refresh problem, cleared on the next success. Posts already shown stay up. */
      lastError: string | null;
      /** Newest first; the 3 shown on /gallery. */
      posts: InstagramPostDto[];
      /** Embeds come from Meta's oEmbed (app approved) rather than the standard embed code. */
      oembed: boolean;
    };

type Id = { id: string };

export type GalleryOps = {
  'gallery.counts': { input: Empty; output: GalleryCounts };
  'gallery.list': { input: { view: GalleryView }; output: { photos: GalleryPhotoDto[]; counts: GalleryCounts } };
  'gallery.takedowns': { input: Empty; output: { requests: TakedownDto[]; counts: GalleryCounts } };
  /** Owner confirms consent. `confirm` must be true (the checkbox). */
  'gallery.confirmConsent': { input: Id & { confirm: boolean }; output: GalleryPhotoDto };
  /** Fails unless consent is confirmed. */
  'gallery.approve': { input: Id; output: GalleryPhotoDto };
  'gallery.reject': { input: Id; output: GalleryPhotoDto };
  /** Take a published photo off the site (restorable). */
  'gallery.remove': { input: Id; output: GalleryPhotoDto };
  /** Removed / rejected → back to pending. */
  'gallery.restore': { input: Id; output: GalleryPhotoDto };
  /** Blank clears it. */
  'gallery.setCaption': { input: Id & { caption: string }; output: GalleryPhotoDto };
  /**
   * Owner upload. Multipart: file part `photo` (JPG/PNG/WebP, ≤ 8 MB). Starts
   * pending; `consentConfirmed: true` records the owner's consent confirmation.
   */
  'gallery.upload': { input: { caption: string; consentConfirmed: boolean }; output: GalleryPhotoDto };
  /** Removes the linked photo (or `photoId` when the request has none) and closes the request. */
  'gallery.resolveTakedown': { input: Id & { photoId?: string }; output: { resolved: true } };
  /** Close without removing anything. */
  'gallery.dismissTakedown': { input: Id; output: { resolved: true } };
  'gallery.instagram': { input: Empty; output: InstagramStatusDto };
  /** Checks the token with Instagram, saves it and pulls the latest posts. */
  'gallery.instagramConnect': { input: { accessToken: string }; output: InstagramStatusDto };
  /** Pull the latest posts now (normally automatic every 30 min while people visit, plus daily). */
  'gallery.instagramRefresh': { input: Empty; output: InstagramStatusDto };
  /** Forget the token and take the posts off the site. */
  'gallery.instagramDisconnect': { input: Empty; output: InstagramStatusDto };
};
