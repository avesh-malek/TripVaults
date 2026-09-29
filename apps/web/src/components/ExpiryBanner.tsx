/** "Expires in 6 hours" style banner; only shown when expiry is close. */
export function ExpiryBanner({ expiresInHours }: { expiresInHours: number }) {
  if (expiresInHours > 48) return null;
  const label =
    expiresInHours <= 0
      ? 'today'
      : expiresInHours < 1
        ? 'within the hour'
        : expiresInHours < 24
          ? `in ${Math.ceil(expiresInHours)} hour${Math.ceil(expiresInHours) === 1 ? '' : 's'}`
          : expiresInHours < 48
            ? 'tomorrow'
            : `in ${Math.ceil(expiresInHours / 24)} days`;
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
      <span className="text-xl" aria-hidden>
        ⏳
      </span>
      <p className="text-sm text-amber-900 dark:text-amber-200">
        <span className="font-semibold">Your gallery expires {label}.</span>{' '}
        Download anything you want to keep before it&apos;s gone.
      </p>
    </div>
  );
}
