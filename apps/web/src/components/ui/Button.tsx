import type { ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:
    'bg-teal-600 text-white hover:bg-teal-700 focus-visible:ring-teal-500 disabled:bg-teal-300 dark:bg-teal-500 dark:hover:bg-teal-400 dark:text-teal-950 dark:disabled:bg-teal-800 dark:disabled:text-teal-200',
  secondary:
    'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus-visible:ring-teal-500 disabled:text-gray-400 dark:bg-stone-900 dark:text-stone-200 dark:border-stone-700 dark:hover:bg-stone-800 dark:disabled:text-stone-500',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 disabled:bg-red-300 dark:bg-red-500 dark:hover:bg-red-400 dark:disabled:bg-red-900',
  ghost:
    'text-teal-700 hover:bg-teal-50 focus-visible:ring-teal-500 disabled:text-teal-300 dark:text-teal-300 dark:hover:bg-teal-950 dark:disabled:text-teal-800',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-950 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
