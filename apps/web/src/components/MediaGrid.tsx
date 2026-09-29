import { useEffect, useRef } from 'react';
import type { MediaListItem } from '@tripvault/shared';
import { MediaCard } from './MediaCard';
import { Spinner } from './ui/Spinner';

export interface MediaGridProps {
  items: MediaListItem[];
  selectedIds: Set<string>;
  selectionMode: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onPreview: (item: MediaListItem) => void;
  onToggleSelect: (id: string) => void;
}

export function MediaGrid({
  items,
  selectedIds,
  selectionMode,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onPreview,
  onToggleSelect,
}: MediaGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          onLoadMore();
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            selected={selectedIds.has(item.id)}
            selectionMode={selectionMode}
            onPreview={onPreview}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
      <div ref={sentinelRef} className="flex h-16 items-center justify-center">
        {isFetchingNextPage && <Spinner />}
      </div>
    </div>
  );
}
