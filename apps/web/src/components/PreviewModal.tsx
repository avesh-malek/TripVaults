import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DownloadUrlResponse, MediaListItem, MediaUrlsResponse } from '@tripvault/shared';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useToast } from './ui/Toast';
import { api } from '../lib/api';
import { formatBytes, formatDate, formatDuration } from '../lib/format';

export interface PreviewModalProps {
  item: MediaListItem | null;
  tripId: string;
  sessionId: string;
  /** Id of the current member. */
  myMemberId: string;
  /** Trip owners may delete any media; members only their own. */
  isOwner: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function PreviewModal({
  item,
  tripId,
  sessionId,
  myMemberId,
  isOwner,
  onClose,
  onDeleted,
}: PreviewModalProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [downloading, setDownloading] = useState<'original' | 'compressed' | null>(null);

  const isVideo = item?.media_kind === 'video';
  const canDelete = !!item && (isOwner || item.uploaded_by === myMemberId);

  const urlsQuery = useQuery({
    queryKey: ['media-urls', item?.id],
    queryFn: () => api<MediaUrlsResponse>(`/media/${item!.id}/urls`, { sessionId }),
    enabled: !!item,
    staleTime: 1000 * 60 * 4,
    retry: 1,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api<{ deleted: true }>(`/media/${item!.id}`, { method: 'DELETE', sessionId }),
    onSuccess: () => {
      toast.success(`${isVideo ? 'Video' : 'Photo'} deleted`);
      setConfirmDelete(false);
      onClose();
      onDeleted();
      void queryClient.invalidateQueries({ queryKey: ['media', tripId] });
    },
    onError: (e: Error) => toast.error(e.message || 'Could not delete this file'),
  });

  const download = async (variant: 'original' | 'compressed') => {
    if (!item) return;
    setDownloading(variant);
    try {
      const res = await api<DownloadUrlResponse>(`/media/${item.id}/download`, {
        sessionId,
        query: { variant },
      });
      // Anchor download keeps the user in the gallery instead of navigating away.
      const a = document.createElement('a');
      a.href = res.url;
      a.download = res.fileName;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const urls = urlsQuery.data;
  // Prefer the lighter compressed rendition for preview; fall back to original.
  const src = isVideo
    ? urls?.compressedUrl ?? urls?.originalUrl ?? null
    : urls?.compressedUrl ?? urls?.originalUrl ?? item?.thumbnailUrl ?? null;

  return (
    <Modal open={!!item} onClose={onClose} title={item?.original_name ?? 'Preview'} maxWidth="max-w-3xl">
      {!item ? null : (
        <div>
          <div className="flex max-h-[60vh] items-center justify-center overflow-hidden rounded-xl bg-black">
            {urlsQuery.isLoading && <Spinner className="m-12" />}
            {urlsQuery.isError && (
              <p className="m-12 text-sm text-gray-300">Couldn&apos;t load this file. Please try again.</p>
            )}
            {src && !isVideo && (
              <img src={src} alt={item.original_name} className="max-h-[60vh] w-auto object-contain" />
            )}
            {src && isVideo && (
              <video
                src={src}
                controls
                playsInline
                poster={item.thumbnailUrl ?? undefined}
                className="max-h-[60vh] w-auto"
              />
            )}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-gray-500 dark:text-stone-500">Uploaded by</dt>
              <dd className="font-medium text-gray-900 dark:text-stone-100">{item.uploaderName}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-stone-500">Size</dt>
              <dd className="font-medium text-gray-900 dark:text-stone-100">{formatBytes(item.file_size)}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-stone-500">Uploaded</dt>
              <dd className="font-medium text-gray-900 dark:text-stone-100">{formatDate(item.created_at)}</dd>
            </div>
            {item.width != null && item.height != null && (
              <div>
                <dt className="text-gray-500 dark:text-stone-500">Dimensions</dt>
                <dd className="font-medium text-gray-900 dark:text-stone-100">
                  {item.width} × {item.height}
                </dd>
              </div>
            )}
            {item.duration != null && (
              <div>
                <dt className="text-gray-500 dark:text-stone-500">Duration</dt>
                <dd className="font-medium text-gray-900 dark:text-stone-100">{formatDuration(item.duration)}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500 dark:text-stone-500">Quality</dt>
              <dd className="font-medium capitalize text-gray-900 dark:text-stone-100">{item.upload_mode}</dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!urls?.originalUrl}
              loading={downloading === 'original'}
              onClick={() => void download('original')}
            >
              Download Original
            </Button>
            {urls?.compressedUrl && (
              <Button
                variant="secondary"
                size="sm"
                loading={downloading === 'compressed'}
                onClick={() => void download('compressed')}
              >
                Download Compressed
              </Button>
            )}
            {canDelete && (
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} className="ml-auto">
                Delete
              </Button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete this file?"
        message="This will permanently remove the file from the trip gallery for everyone. This can't be undone."
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
      />
    </Modal>
  );
}
