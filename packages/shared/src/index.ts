/**
 * Explicit named re-exports (rather than `export *`) so bundlers such as
 * Rollup can statically resolve every export from the compiled CJS output.
 */
export type {
  TripStatus,
  AccessType,
  MemberRole,
  MemberStatus,
  JoinRequestStatus,
  MediaKind,
  UploadMode,
  ProcessingStatus,
  MediaVariant,
  GalleryFilter,
  MemberPublic,
  Trip,
  TripMember,
  JoinRequest,
  Media,
  MediaListItem,
} from './types.js';

export {
  createTripSchema,
  updateTripSchema,
  joinTripSchema,
  initiateUploadSchema,
  extendTripSchema,
  bulkDownloadSchema,
  bulkDeleteSchema,
  mediaQuerySchema,
} from './schemas.js';
export type {
  CreateTripInput,
  UpdateTripInput,
  JoinTripInput,
  InitiateUploadInput,
  ExtendTripInput,
  BulkDownloadInput,
  BulkDeleteInput,
  MediaQueryInput,
} from './schemas.js';

export {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  FREE_AVAILABILITY_OPTIONS,
  FREE_AVAILABILITY_HOURS,
  PREMIUM_AVAILABILITY_OPTIONS,
  MAX_GALLERY_DAYS_FREE,
  MAX_GALLERY_HOURS_FREE,
  GRACE_PERIOD_DAYS,
  GRACE_WARNING_DAYS,
  EXPIRING_SOON_THRESHOLD_HOURS,
  DOWNLOAD_URL_TTL_SECONDS,
  UPLOAD_URL_TTL_SECONDS,
  BULK_DOWNLOAD_MAX_FILES,
  BULK_DOWNLOAD_MAX_BYTES,
  GALLERY_PAGE_SIZE,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  SUPPORTED_IMAGE_MIMES,
  SUPPORTED_VIDEO_MIMES,
  VIDEO_PROCESSING_READY_AFTER_MINUTES,
  mediaKindForMime,
  maxBytesForMime,
  buildStorageKey,
  buildStoragePrefix,
  slugify,
} from './constants.js';

export { SESSION_HEADER } from './api.js';
export type {
  ApiErrorBody,
  InvitePreview,
  InviteStatus,
  InviteStatusResponse,
  CreateTripResponse,
  TripDetailResponse,
  MembersResponse,
  JoinRequestsResponse,
  MediaListResponse,
  UploadUrlSet,
  InitiateUploadResponse,
  MediaUrlsResponse,
  DownloadUrlResponse,
  JoinTripResponse,
} from './api.js';
