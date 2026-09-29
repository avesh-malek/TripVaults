import { Button } from './ui/Button';

export interface SelectionBarProps {
  count: number;
  /** Selected items the current user is allowed to delete (owner: any; member: own). */
  deletableCount: number;
  downloading: boolean;
  deleting: boolean;
  onDownload: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function SelectionBar({
  count,
  deletableCount,
  downloading,
  deleting,
  onDownload,
  onDelete,
  onClear,
}: SelectionBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:pb-6">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-xl dark:border-stone-700 dark:bg-stone-900">
        <p className="text-sm font-medium text-gray-900 dark:text-stone-100">
          {count} selected{count === 1 ? '' : 's'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
          {deletableCount > 0 && (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950"
            >
              {deleting ? 'Deleting…' : `Delete${deletableCount < count ? ` ${deletableCount}` : ''}`}
            </button>
          )}
          <Button size="sm" onClick={onDownload} loading={downloading}>
            Download Selected
          </Button>
        </div>
      </div>
    </div>
  );
}
