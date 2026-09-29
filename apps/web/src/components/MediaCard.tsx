import type { MediaListItem } from '@tripvault/shared';
import { formatDuration } from '../lib/format';

export interface MediaCardProps {
  item: MediaListItem;
  selected: boolean;
  selectionMode: boolean;
  onPreview: (item: MediaListItem) => void;
  onToggleSelect: (id: string) => void;
}

function ImageIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25z"
      />
    </svg>
  );
}

export function MediaCard({ item, selected, selectionMode, onPreview, onToggleSelect }: MediaCardProps) {
  const isVideo = item.media_kind === 'video';
  const processing = item.processing_status === 'processing';
  const failed = item.processing_status === 'failed';

  const handleClick = () => {
    if (selectionMode) onToggleSelect(item.id);
    else onPreview(item);
  };

  return (
    <button
      onClick={handleClick}
      aria-pressed={selectionMode ? selected : undefined}
      className={`group relative aspect-square w-full overflow-hidden rounded-xl bg-gray-100 text-left transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:bg-stone-800 ${
        selected ? 'ring-4 ring-teal-500' : 'hover:shadow-md'
      }`}
    >
      {item.thumbnailUrl ? (
        <img
          src={item.thumbnailUrl}
          alt={item.original_name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-gray-400 dark:text-stone-600">
          <ImageIcon className="h-10 w-10" />
        </span>
      )}

      {processing && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45">
          <svg className="h-6 w-6 animate-spin text-white" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-90"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <span className="rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-medium text-white">
            Processing
          </span>
        </span>
      )}

      {failed && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-red-600/90 px-2 py-0.5 text-[11px] font-medium text-white">
          Couldn&apos;t process
        </span>
      )}

      {isVideo && !processing && (
        <>
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white">
              <svg className="ml-0.5 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
            {formatDuration(item.duration)}
          </span>
        </>
      )}

      {selectionMode && (
        <span
          className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
            selected ? 'border-teal-600 bg-teal-600 text-white' : 'border-white bg-black/40 text-transparent'
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}

      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-left">
        <span className="block truncate text-xs font-medium text-white">{item.uploaderName}</span>
      </span>
    </button>
  );
}
