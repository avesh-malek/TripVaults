import type { GalleryFilter, Media, MediaKind, ProcessingStatus, UploadMode } from '@tripvault/shared';
import { supabase } from '../supabase.js';
import { unwrap } from './helpers.js';
import { AppError } from '../../utils/appError.js';

export interface MediaRow {
  id: string;
  trip_id: string;
  uploaded_by: string;
  original_name: string;
  mime_type: string;
  media_kind: MediaKind;
  // Postgres bigint arrives as a string via the Supabase JS client.
  file_size: number | string;
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

export interface MediaInsert {
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
}

export function mapMedia(row: MediaRow): Media {
  return {
    id: row.id,
    trip_id: row.trip_id,
    uploaded_by: row.uploaded_by,
    original_name: row.original_name,
    mime_type: row.mime_type,
    media_kind: row.media_kind,
    // Coerce Postgres bigint (returned as string) to a JS number.
    file_size: Number(row.file_size),
    width: row.width,
    height: row.height,
    duration: row.duration,
    storage_key: row.storage_key,
    compressed_storage_key: row.compressed_storage_key,
    thumbnail_key: row.thumbnail_key,
    file_hash: row.file_hash,
    upload_mode: row.upload_mode,
    processing_status: row.processing_status,
    created_at: row.created_at,
  };
}

export interface MediaListOptions {
  filter: GalleryFilter;
  memberId: string;
  /** Restrict to media uploaded by this member (member filter). */
  uploaderId?: string;
  limit: number;
  cursor?: string;
}

/**
 * Statuses visible in the gallery. `processing` media (e.g. videos whose
 * background work hasn't finished) show up immediately with a
 * "Processing…" state instead of being hidden; `uploading` rows may not have
 * their bytes stored yet and stay hidden.
 */
const VISIBLE_STATUSES: ProcessingStatus[] = ['ready', 'processing'];

export const mediaRepository = {
  async create(input: MediaInsert): Promise<Media> {
    const { data, error } = await supabase.from('media').insert(input).select().single();
    return mapMedia(unwrap<MediaRow>(data, error, 'media.create'));
  },

  async findById(id: string): Promise<Media | null> {
    const { data, error } = await supabase.from('media').select('*').eq('id', id).maybeSingle();
    const row = unwrap<MediaRow | null>(data, error, 'media.findById');
    return row ? mapMedia(row) : null;
  },

  /** Visible media for the given ids, restricted to one trip. */
  async findReadyByIds(tripId: string, ids: string[]): Promise<Media[]> {
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .eq('trip_id', tripId)
      .in('processing_status', VISIBLE_STATUSES)
      .in('id', ids);
    return unwrap<MediaRow[]>(data ?? [], error, 'media.findReadyByIds').map(mapMedia);
  },

  /**
   * Duplicate detection: same trip + same file hash with a non-failed upload.
   * Retried/failed uploads may be re-initiated, so they are excluded.
   */
  async findDuplicate(tripId: string, fileHash: string): Promise<Media | null> {
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .eq('trip_id', tripId)
      .eq('file_hash', fileHash)
      .neq('processing_status', 'failed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const row = unwrap<MediaRow | null>(data, error, 'media.findDuplicate');
    return row ? mapMedia(row) : null;
  },

  /**
   * Cursor-paginated gallery listing. Newest first (created_at desc, id desc).
   * Returns up to limit+1 rows so callers can detect a next page.
   */
  async listReady(tripId: string, opts: MediaListOptions): Promise<Media[]> {
    let query = supabase
      .from('media')
      .select('*')
      .eq('trip_id', tripId)
      .in('processing_status', VISIBLE_STATUSES);

    if (opts.filter === 'photos') query = query.eq('media_kind', 'image');
    else if (opts.filter === 'videos') query = query.eq('media_kind', 'video');
    else if (opts.filter === 'mine') query = query.eq('uploaded_by', opts.memberId);

    if (opts.uploaderId) query = query.eq('uploaded_by', opts.uploaderId);

    if (opts.cursor) {
      const cursorMedia = await mediaRepository.findById(opts.cursor);
      if (!cursorMedia || cursorMedia.trip_id !== tripId) {
        throw new AppError(404, 'CURSOR_NOT_FOUND', 'Pagination cursor is invalid.');
      }
      const createdAt = cursorMedia.created_at;
      // Keyset: (created_at, id) < (cursor.created_at, cursor.id)
      query = query.or(
        `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${opts.cursor})`,
      );
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(opts.limit + 1);
    return unwrap<MediaRow[]>(data ?? [], error, 'media.listReady').map(mapMedia);
  },

  async countReadyByTripAndKind(tripId: string, kind: MediaKind): Promise<number> {
    const { count, error } = await supabase
      .from('media')
      .select('id', { count: 'exact', head: true })
      .eq('trip_id', tripId)
      .in('processing_status', VISIBLE_STATUSES)
      .eq('media_kind', kind);
    if (error) throw unwrap<never>(null, error, 'media.count');
    return count ?? 0;
  },

  async setStatus(id: string, status: ProcessingStatus): Promise<Media> {
    const { data, error } = await supabase
      .from('media')
      .update({ processing_status: status })
      .eq('id', id)
      .select()
      .single();
    return mapMedia(unwrap<MediaRow>(data, error, 'media.setStatus'));
  },

  /** Videos stuck in 'processing' older than the cutoff (stub for a future worker). */
  async findStaleProcessing(cutoffIso: string): Promise<Media[]> {
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .eq('processing_status', 'processing')
      .lt('created_at', cutoffIso);
    return unwrap<MediaRow[]>(data ?? [], error, 'media.findStaleProcessing').map(mapMedia);
  },

  async deleteById(id: string): Promise<void> {
    const { error } = await supabase.from('media').delete().eq('id', id);
    unwrap<null>(null, error, 'media.deleteById');
  },

  async deleteByTrip(tripId: string): Promise<void> {
    const { error } = await supabase.from('media').delete().eq('trip_id', tripId);
    unwrap<null>(null, error, 'media.deleteByTrip');
  },
};
