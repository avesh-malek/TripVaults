import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { z } from 'zod';
import archiver from 'archiver';
import {
  BULK_DOWNLOAD_MAX_BYTES,
  BULK_DOWNLOAD_MAX_FILES,
  buildStorageKey,
  initiateUploadSchema,
  maxBytesForMime,
  mediaKindForMime,
  slugify,
  type DownloadUrlResponse,
  type InitiateUploadResponse,
  type Media,
  type MediaListItem,
  type MediaListResponse,
  type MediaQueryInput,
  type MediaUrlsResponse,
  type MediaVariant,
  type Trip,
  type TripMember,
  type UploadUrlSet,
} from '@tripvault/shared';
import { mediaRepository } from '../db/repositories/mediaRepository.js';
import { memberRepository } from '../db/repositories/memberRepository.js';
import { tripRepository } from '../db/repositories/tripRepository.js';
import { config } from '../config.js';
import { storage } from '../storage/index.js';
import { DuplicateError, AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

type InitiateUploadInput = z.infer<typeof initiateUploadSchema>;

async function toMediaListItem(media: Media, uploaderName: string, thumbnailUrl: string | null): Promise<MediaListItem> {
  return { ...media, uploaderName, thumbnailUrl };
}

async function thumbnailUrlFor(media: Media): Promise<string | null> {
  if (!media.thumbnail_key) return null;
  return storage.getDownloadUrl(media.thumbnail_key, `${media.id}-thumbnail.jpg`, config.DOWNLOAD_URL_TTL_SECONDS);
}

async function uploaderNameFor(media: Media): Promise<string> {
  const uploader = await memberRepository.findById(media.uploaded_by);
  return uploader?.name ?? 'Unknown';
}

function requireWritableTrip(trip: Trip): void {
  const ok = (trip.status === 'active' || trip.status === 'expiring_soon') &&
    new Date(trip.expires_at).getTime() > Date.now();
  if (!ok) {
    throw new AppError(410, 'TRIP_EXPIRED', 'This trip has expired and no longer accepts uploads.');
  }
}

/** Resolve the storage key for a download variant. */
function keyForVariant(media: Media, variant: MediaVariant): string | null {
  if (variant === 'original') return media.storage_key;
  if (variant === 'compressed') return media.compressed_storage_key ?? media.storage_key;
  return media.thumbnail_key;
}

function expiresAt(ttlSeconds: number): string {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

export const mediaService = {
  async listMedia(tripId: string, member: TripMember, query: MediaQueryInput): Promise<MediaListResponse> {
    const rows = await mediaRepository.listReady(tripId, {
      filter: query.filter,
      memberId: member.id,
      limit: query.limit,
      cursor: query.cursor,
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    const items: MediaListItem[] = await Promise.all(
      page.map(async (media) => toMediaListItem(media, await uploaderNameFor(media), await thumbnailUrlFor(media))),
    );

    const last = page.length > 0 ? page[page.length - 1] : undefined;
    return {
      items,
      nextCursor: hasMore && last ? last.id : null,
    };
  },

  async initiateUpload(tripId: string, member: TripMember, input: InitiateUploadInput): Promise<InitiateUploadResponse> {
    const trip = await tripRepository.findById(tripId);
    if (!trip) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found.');
    requireWritableTrip(trip);

    const kind = mediaKindForMime(input.mimeType);
    const maxBytes = maxBytesForMime(input.mimeType);
    if (kind === null || maxBytes === null) {
      throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', `MIME type ${input.mimeType} is not supported.`);
    }
    if (input.fileSize > maxBytes) {
      throw new AppError(413, 'FILE_TOO_LARGE', 'The file exceeds the maximum allowed size.');
    }

    const existing = await mediaRepository.findDuplicate(tripId, input.fileHash);
    if (existing) {
      const duplicate = await toMediaListItem(existing, await uploaderNameFor(existing), await thumbnailUrlFor(existing));
      throw new DuplicateError(duplicate);
    }

    const mediaId = randomUUID();
    const thumbnailKey = buildStorageKey(tripId, mediaId, 'thumbnail');
    const originalKey = input.uploadMode === 'original' ? buildStorageKey(tripId, mediaId, 'original') : null;
    const compressedKey = input.uploadMode === 'compressed' ? buildStorageKey(tripId, mediaId, 'compressed') : null;

    const media = await mediaRepository.create({
      id: mediaId,
      trip_id: tripId,
      uploaded_by: member.id,
      original_name: input.originalName,
      mime_type: input.mimeType,
      media_kind: kind,
      file_size: input.fileSize,
      upload_mode: input.uploadMode,
      storage_key: originalKey,
      compressed_storage_key: compressedKey,
      thumbnail_key: thumbnailKey,
      file_hash: input.fileHash,
      width: input.width ?? null,
      height: input.height ?? null,
      duration: input.duration ?? null,
      processing_status: 'uploading',
    });

    const uploadUrls: UploadUrlSet = {};
    if (originalKey) {
      uploadUrls.original = await storage.getUploadUrl(originalKey, input.mimeType, config.UPLOAD_URL_TTL_SECONDS);
    }
    if (compressedKey) {
      uploadUrls.compressed = await storage.getUploadUrl(compressedKey, input.mimeType, config.UPLOAD_URL_TTL_SECONDS);
    }
    uploadUrls.thumbnail = await storage.getUploadUrl(thumbnailKey, 'image/jpeg', config.UPLOAD_URL_TTL_SECONDS);

    // The thumbnail isn't uploaded yet, so no usable thumbnail URL exists at this point.
    return { media, uploadUrls };
  },

  /** Called by the uploader after the file PUT(s) succeed. */
  async completeUpload(media: Media, member: TripMember): Promise<{ media: Media }> {
    if (media.uploaded_by !== member.id) {
      throw new AppError(403, 'NOT_UPLOADER', 'Only the uploader can complete this upload.');
    }
    if (media.processing_status !== 'uploading') {
      throw new AppError(409, 'INVALID_UPLOAD_STATE', 'This upload is not in progress.');
    }
    const next = media.media_kind === 'video' ? 'processing' : 'ready';
    const updated = await mediaRepository.setStatus(media.id, next);
    return { media: updated };
  },

  async failUpload(media: Media, member: TripMember): Promise<{ media: Media }> {
    if (media.uploaded_by !== member.id) {
      throw new AppError(403, 'NOT_UPLOADER', 'Only the uploader can fail this upload.');
    }
    const updated = await mediaRepository.setStatus(media.id, 'failed');
    return { media: updated };
  },

  async deleteMedia(media: Media, member: TripMember): Promise<{ deleted: true }> {
    if (media.uploaded_by !== member.id) {
      throw new AppError(403, 'NOT_UPLOADER', 'Only the uploader can delete this media.');
    }
    const keys = [media.storage_key, media.compressed_storage_key, media.thumbnail_key];
    await Promise.all(
      keys.filter((k): k is string => !!k).map(async (key) => {
        try {
          await storage.deleteObject(key);
        } catch (err) {
          // Missing objects are fine; log anything else and continue.
          logger.warn(`Failed to delete storage object ${key}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }),
    );
    await mediaRepository.deleteById(media.id);
    return { deleted: true };
  },

  async getMediaUrls(media: Media): Promise<MediaUrlsResponse> {
    const ttl = config.DOWNLOAD_URL_TTL_SECONDS;
    const result: MediaUrlsResponse = {
      originalUrl: media.storage_key
        ? await storage.getDownloadUrl(media.storage_key, media.original_name, ttl)
        : null,
      compressedUrl: media.compressed_storage_key
        ? await storage.getDownloadUrl(media.compressed_storage_key, media.original_name, ttl)
        : null,
      thumbnailUrl: media.thumbnail_key
        ? await storage.getDownloadUrl(media.thumbnail_key, `${media.id}-thumbnail.jpg`, ttl)
        : null,
      expiresAt: expiresAt(ttl),
    };
    return result;
  },

  async getDownloadUrl(media: Media, variant: MediaVariant): Promise<DownloadUrlResponse> {
    const key = keyForVariant(media, variant);
    if (!key) {
      throw new AppError(404, 'VARIANT_NOT_AVAILABLE', `The ${variant} variant is not available for this media.`);
    }
    const fileName = variant === 'thumbnail' ? `${media.id}-thumbnail.jpg` : media.original_name;
    const ttl = config.DOWNLOAD_URL_TTL_SECONDS;
    const url = await storage.getDownloadUrl(key, fileName, ttl);
    return { url, expiresAt: expiresAt(ttl), fileName };
  },

  async bulkDownload(
    tripId: string,
    _member: TripMember,
    mediaIds: string[],
  ): Promise<{ stream: NodeJS.ReadableStream; fileName: string }> {
    if (mediaIds.length > BULK_DOWNLOAD_MAX_FILES) {
      throw new AppError(413, 'BULK_LIMIT_EXCEEDED', `Select at most ${BULK_DOWNLOAD_MAX_FILES} files.`);
    }

    const trip = await tripRepository.findById(tripId);
    if (!trip) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found.');

    const items = await mediaRepository.findReadyByIds(tripId, mediaIds);
    if (items.length !== mediaIds.length) {
      throw new AppError(404, 'MEDIA_NOT_FOUND', 'One or more selected items were not found in this trip.');
    }

    const totalBytes = items.reduce((sum, m) => sum + m.file_size, 0);
    if (totalBytes > BULK_DOWNLOAD_MAX_BYTES) {
      throw new AppError(413, 'BULK_LIMIT_EXCEEDED', 'The selection exceeds the 2 GiB bulk download limit.');
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    // Append entries before finalizing; stream errors are surfaced via the 'error' event.
    for (const item of items) {
      const key = item.compressed_storage_key ?? item.storage_key;
      if (!key) continue;
      const objectStream = await storage.getObjectStream(key);
      // getObjectStream yields NodeJS.ReadableStream; archiver wants a node Readable.
      archive.append(objectStream as unknown as Readable, { name: item.original_name });
    }
    void archive.finalize();

    return { stream: archive, fileName: `${slugify(trip.name)}-selected.zip` };
  },
};
