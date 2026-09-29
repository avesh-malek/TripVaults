import { useToast } from './ui/Toast';
import { Button } from './ui/Button';

export interface InviteLinkBoxProps {
  inviteCode: string;
  compact?: boolean;
}

export function inviteLink(inviteCode: string): string {
  return `${window.location.origin}/join/${inviteCode}`;
}

export function InviteLinkBox({ inviteCode, compact = false }: InviteLinkBoxProps) {
  const toast = useToast();
  const link = inviteLink(inviteCode);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Invite link copied to clipboard');
    } catch {
      // Fallback for browsers without clipboard permission.
      const input = document.createElement('input');
      input.value = link;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      toast.success('Invite link copied to clipboard');
    }
  };

  return (
    <div className={compact ? '' : 'rounded-2xl border border-gray-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900'}>
      {!compact && (
        <>
          <p className="text-sm font-medium text-gray-900 dark:text-stone-100">Invite link</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-stone-400">
            Share this link with your travel buddies so they can join the gallery.
          </p>
        </>
      )}
      <div className={`flex gap-2 ${compact ? '' : 'mt-3'}`}>
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          aria-label="Invite link"
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
        />
        <Button variant="secondary" size="sm" onClick={() => void copy()} className="shrink-0">
          Copy
        </Button>
      </div>
    </div>
  );
}
