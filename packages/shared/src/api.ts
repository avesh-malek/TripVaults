/**
 * TripVault API data transfer objects.
 *
 * The API team implements routes that return exactly these shapes; the web
 * app consumes them with no further transformation.
 */
import type {
  JoinRequest,
  Media,
  MediaListItem,
  MemberPublic,
  Trip,
} from './types.js';

/* ---------------- Errors ---------------- */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/* ---------------- Invites ---------------- */

export interface InvitePreview {
  trip: Pick<
    Trip,
    'id' | 'name' | 'description' | 'access_type' | 'expires_at' | 'status'
  >;
  memberCount: number;
  ownerName: string;
}

export type InviteStatus = 'none' | 'pending' | 'rejected' | 'member';

export interface InviteStatusResponse {
  status: InviteStatus;
  tripId: string | null;
}

/* ---------------- Trips ---------------- */

export interface CreateTripResponse {
  trip: Trip;
  member: MemberPublic;
}

export interface TripDetailResponse {
  trip: Trip;
  memberCount: number;
  photoCount: number;
  videoCount: number;
  myMember: MemberPublic;
  isOwner: boolean;
  /** Whole hours (rounded up) from now until `trip.expires_at`; may be 0. */
  expiresInHours: number;
}

export type JoinTripResponse =
  | { status: 'joined'; trip: Trip; member: MemberPublic }
  | { status: 'pending'; joinRequest: JoinRequest };

/* ---------------- Members ---------------- */

export interface MembersResponse {
  members: MemberPublic[];
}

export interface JoinRequestsResponse {
  requests: JoinRequest[];
}

/* ---------------- Media ---------------- */

export interface MediaListResponse {
  items: MediaListItem[];
  nextCursor: string | null;
}

export interface UploadUrlSet {
  original?: string;
  compressed?: string;
  thumbnail?: string;
}

export interface InitiateUploadResponse {
  media: Media;
  uploadUrls: UploadUrlSet;
}

export interface MediaUrlsResponse {
  originalUrl: string | null;
  compressedUrl: string | null;
  thumbnailUrl: string | null;
  expiresAt: string;
}

export interface DownloadUrlResponse {
  url: string;
  expiresAt: string;
  fileName: string;
}

/* ---------------- Auth ---------------- */

/** Request header that carries the caller's session id. */
export const SESSION_HEADER = 'x-session-id';
