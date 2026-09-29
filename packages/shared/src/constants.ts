/**
 * TripVault shared constants and helpers.
 *
 * The backend and frontend teams import everything from `@tripvault/shared`
 * so limits and conventions stay identical on both sides.
 */
import type { MediaKind, MediaVariant } from './types.js';

/* ---------------- Invite codes ---------------- */

/** Invite codes use unambiguous uppercase letters + digits (no 0/O, 1/I/L). */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;

/* ---------------- Availability / lifecycle ---------------- */

/** Gallery lifetime options (days) for the free tier. */
export const FREE_AVAILABILITY_OPTIONS = [1, 3, 7, 14] as const;
/** Gallery lifetime options (days) reserved for the premium tier. */
export const PREMIUM_AVAILABILITY_OPTIONS = [30, 60] as const;
/** Maximum gallery lifetime (days) allowed on the free tier. */
export const MAX_GALLERY_DAYS_FREE = 14;

/** Days after expiry before the trip is soft-deleted. */
export const GRACE_PERIOD_DAYS = 7;
/**
 * Days after expiry before the trip moves `expired` → `grace_period`
 * (media download only). After GRACE_PERIOD_DAYS it becomes `deleted`.
 */
export const GRACE_WARNING_DAYS = 5;

/** Hours before `expires_at` a trip reports as `expiring_soon`. */
export const EXPIRING_SOON_THRESHOLD_HOURS = 48;

/* ---------------- Signed URL TTLs (seconds) ---------------- */

export const DOWNLOAD_URL_TTL_SECONDS = 900;
export const UPLOAD_URL_TTL_SECONDS = 3600;

/* ---------------- Downloads ---------------- */

export const BULK_DOWNLOAD_MAX_FILES = 100;
export const BULK_DOWNLOAD_MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB

/* ---------------- Gallery ---------------- */

export const GALLERY_PAGE_SIZE = 60;

/* ---------------- Upload limits ---------------- */

export const MAX_IMAGE_BYTES = 50 * 1024 * 1024; // 50 MiB
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB

export const SUPPORTED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export const SUPPORTED_VIDEO_MIMES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;

/**
 * Minutes after which a `processing` video is assumed ready (fallback if the
 * transcoding worker never reported back).
 */
export const VIDEO_PROCESSING_READY_AFTER_MINUTES = 10;

/* ---------------- Helpers ---------------- */

const IMAGE_MIME_SET: ReadonlySet<string> = new Set(SUPPORTED_IMAGE_MIMES);
const VIDEO_MIME_SET: ReadonlySet<string> = new Set(SUPPORTED_VIDEO_MIMES);

/** Map a MIME type to its media kind, or `null` when unsupported. */
export function mediaKindForMime(mime: string): MediaKind | null {
  const normalized = mime.toLowerCase();
  if (IMAGE_MIME_SET.has(normalized)) return 'image';
  if (VIDEO_MIME_SET.has(normalized)) return 'video';
  return null;
}

/** Max allowed upload bytes for a MIME type, or `null` when unsupported. */
export function maxBytesForMime(mime: string): number | null {
  const kind = mediaKindForMime(mime);
  if (kind === 'image') return MAX_IMAGE_BYTES;
  if (kind === 'video') return MAX_VIDEO_BYTES;
  return null;
}

/**
 * Storage key for one variant of a media file:
 * `trips/${tripId}/media/${mediaId}/${variant}`
 */
export function buildStorageKey(
  tripId: string,
  mediaId: string,
  variant: MediaVariant,
): string {
  return `trips/${tripId}/media/${mediaId}/${variant}`;
}

/** Storage prefix that holds every variant of every media in a trip. */
export function buildStoragePrefix(tripId: string): string {
  return `trips/${tripId}/media`;
}

/**
 * URL/file-name friendly slug of a display name. Not guaranteed unique —
 * callers combine it with other identifiers when uniqueness matters.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
