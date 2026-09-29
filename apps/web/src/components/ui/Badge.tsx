import type { ReactNode } from 'react';

type Color = 'teal' | 'green' | 'amber' | 'red' | 'gray' | 'blue';

const colors: Record<Color, string> = {
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  green: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  gray: 'bg-gray-100 text-gray-700 dark:bg-stone-800 dark:text-stone-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
};

export function Badge({ color = 'gray', children }: { color?: Color; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[color]}`}
    >
      {children}
    </span>
  );
}
