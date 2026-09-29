export function ExpiryBanner({ expiresInDays }: { expiresInDays: number }) {
  if (expiresInDays > 2) return null;
  const label =
    expiresInDays <= 0
      ? 'today'
      : expiresInDays === 1
        ? 'tomorrow'
        : `in ${expiresInDays} days`;
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
      <span className="text-xl" aria-hidden>⏳</span>
      <p className="text-sm text-amber-900">
        <span className="font-semibold">Your gallery expires {label}.</span>{' '}
        Download anything you want to keep before it's gone.
      </p>
    </div>
  );
}
