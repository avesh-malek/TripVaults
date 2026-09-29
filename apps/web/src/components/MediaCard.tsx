import type { MediaListItem } from '@tripvault/shared';
import { formatDuration } from '../lib/format';

export interface MediaCardProps {
  item: MediaListItem;
  selected: boolean;
  selectionMode: boolean;
  onPreview: (item: MediaListItem) => void;
  onToggleSelect: (id: string) => void;
}

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23e5e7eb'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='48' fill='%239ca3af'%3E%F0%9F%96%BC%EF%B8%8F%3C/text%3E%3C/svg%3E";

export function MediaCard({ item, selected, selectionMode, onPreview, onToggleSelect }: MediaCardProps) {
  const isVideo = item.media_kind === 'video';

  const handleClick = () => {
    if (selectionMode) onToggleSelect(item.id);
    else onPreview(item);
  };

  return (
    <button
      onClick={handleClick}
      aria-pressed={selectionMode ? selected : undefined}
      className={`group relative aspect-square w-full overflow-hidden rounded-xl bg-gray-100 text-left transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        selected ? 'ring-4 ring-indigo-500' : 'hover:shadow-md'
      }`}
    >
      <img
        src={item.thumbnailUrl ?? PLACEHOLDER}
        alt={item.original_name}
        loading="lazy"
        className="h-full w-full object-cover"
      />

      {selectionMode && (
        <span
          className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
            selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-white bg-black/40 text-transparent'
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}

      {isVideo && (
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

      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-left">
        <span className="block truncate text-xs font-medium text-white">{item.uploaderName}</span>
      </span>
    </button>
  );
}
