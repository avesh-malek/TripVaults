import { useCallback, useRef, useState } from 'react';
import {
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  SUPPORTED_IMAGE_MIMES,
  SUPPORTED_VIDEO_MIMES,
  mediaKindForMime,
  maxBytesForMime,
} from '@tripvault/shared';
import type {
  InitiateUploadInput,
  InitiateUploadResponse,
  MediaKind,
  UploadMode,
} from '@tripvault/shared';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';
import { useToast } from './ui/Toast';
import { ApiError, api } from '../lib/api';
import {
  sha256Hex,
  getImageDimensions,
  getVideoMetadata,
  compressImage,
  makeThumbnail,
  putWithProgress,
} from '../lib/upload';
import { formatBytes } from '../lib/format';

const ACCEPT = [...SUPPORTED_IMAGE_MIMES, ...SUPPORTED_VIDEO_MIMES].join(',');
const CONCURRENCY = 3;

type QueueStatus = 'queued' | 'working' | 'done' | 'duplicate' | 'error';

interface QueueItem {
  id: string;
  file: File;
  status: QueueStatus;
  /** 0..1 progress of the current/last attempt. */
  progress: number;
  error: string | null;
  mediaId: string | null;
}

export interface UploadPanelProps {
  tripId: string;
  sessionId: string;
  onUploaded: () => void;
}

function validateFile(file: File): { kind: MediaKind } | { error: string } {
  const kind = mediaKindForMime(file.type);
  if (!kind) {
    return {
      error: `“${file.name}” isn't a supported file type. We accept JPG, PNG, WebP, HEIC and MP4, MOV, WebM files.`,
    };
  }
  const max = maxBytesForMime(file.type);
  if (max != null && file.size > max) {
    return {
      error: `“${file.name}” is too large (${formatBytes(file.size)}). The limit for this file type is ${formatBytes(max)}.`,
    };
  }
  return { kind };
}

export function UploadPanel({ tripId, sessionId, onUploaded }: UploadPanelProps) {
  const toast = useToast();
  const [quality, setQuality] = useState<UploadMode>('original');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Mirror of queue for async workers (avoids stale closures).
  const queueRef = useRef<QueueItem[]>([]);
  queueRef.current = queue;

  const patchItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const fresh: QueueItem[] = [];
      for (const file of Array.from(files)) {
        const validation = validateFile(file);
        if ('error' in validation) {
          fresh.push({
            id: crypto.randomUUID(),
            file,
            status: 'error',
            progress: 0,
            error: validation.error,
            mediaId: null,
          });
        } else {
          fresh.push({
            id: crypto.randomUUID(),
            file,
            status: 'queued',
            progress: 0,
            error: null,
            mediaId: null,
          });
        }
      }
      if (fresh.length > 0) setQueue((prev) => [...prev, ...fresh]);
    },
    [],
  );

  /** Full pipeline for one file: hash → initiate → PUTs → complete. */
  const processItem = useCallback(
    async (item: QueueItem, mode: UploadMode): Promise<void> => {
      const { file } = item;
      const kind = mediaKindForMime(file.type);
      if (!kind) {
        patchItem(item.id, { status: 'error', error: 'Unsupported file type.' });
        return;
      }
      let mediaId: string | null = null;
      try {
        patchItem(item.id, { status: 'working', progress: 0, error: null });

        const fileHash = await sha256Hex(file);
        let width: number | undefined;
        let height: number | undefined;
        let duration: number | undefined;
        if (kind === 'image') {
          const dims = await getImageDimensions(file);
          width = dims.width;
          height = dims.height;
        } else {
          const meta = await getVideoMetadata(file);
          width = meta.width || undefined;
          height = meta.height || undefined;
          duration = meta.duration || undefined;
        }

        const payload: InitiateUploadInput = {
          originalName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          fileHash,
          uploadMode: mode,
          ...(width ? { width } : {}),
          ...(height ? { height } : {}),
          ...(duration ? { duration } : {}),
        };

        let init: InitiateUploadResponse;
        try {
          init = await api<InitiateUploadResponse>(`/trips/${tripId}/media/initiate`, {
            method: 'POST',
            sessionId,
            body: payload,
          });
        } catch (e) {
          if (e instanceof ApiError && e.status === 409 && e.code === 'DUPLICATE_MEDIA') {
            patchItem(item.id, { status: 'duplicate', progress: 1 });
            return;
          }
          throw e;
        }
        mediaId = init.media.id;
        patchItem(item.id, { mediaId });

        const { uploadUrls } = init;
        const setMainProgress = (fraction: number) =>
          patchItem(item.id, { progress: 0.1 + fraction * 0.9 });

        // 1) Thumbnail (best effort, ~10% of the bar).
        try {
          const thumb = await makeThumbnail(file, kind);
          if (thumb && uploadUrls.thumbnail) {
            await putWithProgress(uploadUrls.thumbnail, thumb, 'image/jpeg', (f) =>
              patchItem(item.id, { progress: f * 0.1 }),
            );
          }
        } catch {
          /* thumbnails are optional — continue with the main upload */
        }

        // 2) Main payload.
        if (mode === 'compressed' && kind === 'image') {
          const compressed = await compressImage(file);
          const url = uploadUrls.compressed ?? uploadUrls.original;
          if (!url) throw new Error('No upload URL returned by the server');
          await putWithProgress(url, compressed.blob, 'image/jpeg', setMainProgress);
        } else {
          const url = uploadUrls.original ?? uploadUrls.compressed;
          if (!url) throw new Error('No upload URL returned by the server');
          await putWithProgress(url, file, file.type || 'application/octet-stream', setMainProgress);
        }

        // 3) Mark complete.
        await api(`/media/${mediaId}/complete`, { method: 'POST', sessionId });
        patchItem(item.id, { status: 'done', progress: 1 });
      } catch (e) {
        if (mediaId) {
          // Best effort: release the reservation so it doesn't linger as "uploading".
          try {
            await api(`/media/${mediaId}/fail`, { method: 'POST', sessionId });
          } catch {
            /* ignore */
          }
        }
        patchItem(item.id, {
          status: 'error',
          error: e instanceof Error ? e.message : 'Upload failed',
        });
      }
    },
    [patchItem, sessionId, tripId],
  );

  const startUpload = useCallback(
    async (onlyIds?: Set<string>) => {
      const targets = queueRef.current.filter(
        (q) => q.status === 'queued' || (onlyIds?.has(q.id) && q.status === 'error'),
      );
      if (targets.length === 0 || isUploading) return;
      setIsUploading(true);
      try {
        // Bounded worker pool.
        const pending = [...targets];
        const workers = Array.from({ length: Math.min(CONCURRENCY, pending.length) }, async () => {
          while (pending.length > 0) {
            const next = pending.shift();
            if (next) await processItem(next, quality);
          }
        });
        await Promise.all(workers);
        onUploaded();
      } finally {
        setIsUploading(false);
      }
    },
    [isUploading, onUploaded, processItem, quality],
  );

  const queuedCount = queue.filter((q) => q.status === 'queued').length;
  const errorCount = queue.filter((q) => q.status === 'error').length;
  const doneCount = queue.filter((q) => q.status === 'done' || q.status === 'duplicate').length;
  const activeCount = queue.filter((q) => q.status === 'working').length;
  const overallProgress =
    queue.length === 0 ? 0 : queue.reduce((sum, q) => sum + q.progress, 0) / queue.length;

  const statusBadge = (item: QueueItem) => {
    switch (item.status) {
      case 'queued':
        return <Badge color="gray">Queued</Badge>;
      case 'working':
        return <Badge color="blue">Uploading</Badge>;
      case 'done':
        return <Badge color="green">Done</Badge>;
      case 'duplicate':
        return <Badge color="amber">Duplicate — skipped</Badge>;
      case 'error':
        return <Badge color="red">Error</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Add photos and videos to upload"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white hover:border-indigo-400'
        }`}
      >
        <div className="text-4xl">📤</div>
        <p className="mt-3 font-medium text-gray-900">Drag & drop photos and videos here</p>
        <p className="mt-1 text-sm text-gray-500">
          or <span className="font-medium text-indigo-600">browse your files</span>
        </p>
        <p className="mt-2 text-xs text-gray-400">
          JPG, PNG, WebP, HEIC · MP4, MOV, WebM — photos up to {formatBytes(MAX_IMAGE_BYTES)},
          videos up to {formatBytes(MAX_VIDEO_BYTES)}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Quality choice */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <p className="text-sm font-medium text-gray-900">Upload quality</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label
            className={`cursor-pointer rounded-xl border p-3 transition-colors ${
              quality === 'original' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="quality"
                checked={quality === 'original'}
                onChange={() => setQuality('original')}
                className="h-4 w-4 accent-indigo-600"
              />
              <span className="text-sm font-medium text-gray-900">Original</span>
            </div>
            <p className="mt-1 pl-6 text-xs text-gray-500">Full quality, exactly as captured. Larger files.</p>
          </label>
          <label
            className={`cursor-pointer rounded-xl border p-3 transition-colors ${
              quality === 'compressed' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="quality"
                checked={quality === 'compressed'}
                onChange={() => setQuality('compressed')}
                className="h-4 w-4 accent-indigo-600"
              />
              <span className="text-sm font-medium text-gray-900">Compressed</span>
            </div>
            <p className="mt-1 pl-6 text-xs text-gray-500">Smaller, faster uploads.</p>
          </label>
        </div>
        {quality === 'compressed' && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠️ Compressed uploads can't be restored to original quality later.
          </p>
        )}
      </div>

      {/* Queue */}
      {queue.length === 0 ? (
        <EmptyState
          icon="🖼️"
          title="No files yet"
          description="Add photos or videos above and they'll appear here ready to upload."
        />
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-medium text-gray-900">
              {queue.length} file{queue.length === 1 ? '' : 's'}
              {doneCount > 0 && <span className="ml-2 text-gray-500">· {doneCount} uploaded</span>}
            </p>
            <div className="flex gap-2">
              {errorCount > 0 && !isUploading && (
                <Button variant="secondary" size="sm" onClick={() => void startUpload(new Set(queue.filter((q) => q.status === 'error').map((q) => q.id)))}>
                  Retry failed
                </Button>
              )}
              <Button
                size="sm"
                disabled={queuedCount === 0 || isUploading}
                loading={isUploading && activeCount > 0}
                onClick={() => void startUpload()}
              >
                {isUploading ? `Uploading…` : `Upload ${queuedCount} file${queuedCount === 1 ? '' : 's'}`}
              </Button>
            </div>
          </div>

          {(isUploading || activeCount > 0) && (
            <div className="border-b border-gray-100 px-4 py-3">
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{ width: `${Math.round(overallProgress * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">{Math.round(overallProgress * 100)}% overall</p>
            </div>
          )}

          <ul className="divide-y divide-gray-100">
            {queue.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{item.file.name}</p>
                    <p className="text-xs text-gray-500">{formatBytes(item.file.size)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(item)}
                    {item.status === 'error' && !isUploading && (
                      <Button variant="ghost" size="sm" onClick={() => void startUpload(new Set([item.id]))}>
                        Retry
                      </Button>
                    )}
                    {(item.status === 'queued' || item.status === 'error') && !isUploading && (
                      <button
                        onClick={() => setQueue((prev) => prev.filter((q) => q.id !== item.id))}
                        aria-label={`Remove ${item.file.name}`}
                        className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                {item.status === 'working' && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all"
                      style={{ width: `${Math.round(item.progress * 100)}%` }}
                    />
                  </div>
                )}
                {item.status === 'error' && item.error && (
                  <p className="mt-1 text-xs text-red-600">{item.error}</p>
                )}
                {item.status === 'duplicate' && (
                  <p className="mt-1 text-xs text-amber-700">This exact file is already in the gallery.</p>
                )}
              </li>
            ))}
          </ul>

          {queue.length > 0 && !isUploading && (
            <div className="border-t border-gray-100 px-4 py-3">
              <button
                onClick={() => {
                  setQueue([]);
                  toast.info('Upload queue cleared');
                }}
                className="text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                Clear finished queue
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
