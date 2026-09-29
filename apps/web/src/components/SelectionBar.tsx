import { Button } from './ui/Button';

export interface SelectionBarProps {
  count: number;
  downloading: boolean;
  onDownload: () => void;
  onClear: () => void;
}

export function SelectionBar({ count, downloading, onDownload, onClear }: SelectionBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:pb-6">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-2xl bg-gray-900 px-4 py-3 shadow-xl">
        <p className="text-sm font-medium text-white">
          {count} selected{count === 1 ? '' : 's'}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClear} className="!text-gray-300 hover:!bg-gray-700">
            Clear
          </Button>
          <Button size="sm" onClick={onDownload} loading={downloading}>
            Download Selected
          </Button>
        </div>
      </div>
    </div>
  );
}
