import { Link, NavLink } from 'react-router-dom';
import { useTheme } from '../../lib/theme';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="TripVault home">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 dark:bg-teal-500">
        <svg className="h-5 w-5 text-white dark:text-teal-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <rect x="3" y="7" width="18" height="13" rx="2.5" />
          <circle cx="12" cy="13.5" r="3.5" />
          <path d="M8.5 7l1.2-2.5h4.6L15.5 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {!compact && (
        <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-stone-100">
          TripVault
        </span>
      )}
    </Link>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
    >
      {theme === 'dark' ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36 6.36l-1.42-1.42M7.05 7.05L5.64 5.64m12.73 0l-1.42 1.41M7.05 16.95l-1.41 1.41M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.35 14.5A8.5 8.5 0 019.5 3.65a8.5 8.5 0 1010.85 10.85z"
          />
        </svg>
      )}
    </button>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white dark:border-stone-800 dark:bg-stone-950">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100'
              }`
            }
          >
            My Trips
          </NavLink>
          <NavLink
            to="/trips/create"
            className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 dark:bg-teal-500 dark:text-teal-950 dark:hover:bg-teal-400"
          >
            + New Trip
          </NavLink>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
