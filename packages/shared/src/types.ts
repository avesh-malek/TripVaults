/**
 * TripVault domain types.
 *
 * Conventions (the backend and frontend teams code against exactly these):
 * - Every timestamp is an ISO 8601 string in UTC.
 * - Every ID is a UUID string.
 * - Nullable DB columns are `T | null` here (not optional).
 */

export type TripStatus =
  | 'active'
  | 'expiring_soon'
  | 'expired'
  | 'grace_period'
  | 'deleted';

export type AccessType = 'open' | 'approval';

export type MemberRole = 'owner' | 'member';

export type MemberStatus = 'active' | 'left' | 'removed';

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

export type MediaKind = 'image' | 'video';

export type UploadMode = 'original' | 'compressed';

export type ProcessingStatus =
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'failed';

export type MediaVariant = 'original' | 'compressed' | 'thumbnail';

export type GalleryFilter = 'all' | 'photos' | 'videos' | 'mine';

export interface Trip {
  id: string;
  name: string;
  description: string | null;
  owner_member_id: string | null;
  invite_code: string;
  access_type: AccessType;
  expires_at: string;
  status: TripStatus;
  created_at: string;
  updated_at: string;
}

export interface TripMember {
  id: string;
  trip_id: string;
  name: string;
  session_id: string;
  role: MemberRole;
  joined_at: string;
  last_seen_at: string;
  status: MemberStatus;
}

/** TripMember without the server-side session secret. */
export type MemberPublic = Omit<TripMember, 'session_id'>;

export interface JoinRequest {
  id: string;
  trip_id: string;
  name: string;
  session_id: string;
  status: JoinRequestStatus;
  created_at: string;
  responded_at: string | null;
}

export interface Media {
  id: string;
  trip_id: string;
  uploaded_by: string;
  original_name: string;
  mime_type: string;
  media_kind: MediaKind;
  file_size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  storage_key: string | null;
  compressed_storage_key: string | null;
  thumbnail_key: string | null;
  file_hash: string;
  upload_mode: UploadMode;
  processing_status: ProcessingStatus;
  created_at: string;
}

export interface MediaListItem extends Media {
  uploaderName: string;
  thumbnailUrl: string | null;
}
