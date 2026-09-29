import type { Media, Trip, TripMember } from '@tripvault/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      /** Set by requireTripMember / requireMediaMember before protected handlers run. */
      trip: Trip;
      /** The caller's active membership. Set by requireTripMember / requireMediaMember. */
      member: TripMember;
      /** Set by requireMediaMember. */
      media: Media;
    }
  }
}

export {};
