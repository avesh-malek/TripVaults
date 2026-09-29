import type { InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, id, className = '', ...rest }: InputProps) {
  const inputId = id ?? `input-${label?.replace(/\s+/g, '-').toLowerCase() ?? Math.random().toString(36).slice(2)}`;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-stone-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...rest}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:bg-stone-900 dark:text-stone-100 dark:placeholder-stone-500 dark:border-stone-700 ${
          error ? 'border-red-400 dark:border-red-500' : 'border-gray-300'
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-gray-500 dark:text-stone-400">{hint}</p>}
    </div>
  );
}
