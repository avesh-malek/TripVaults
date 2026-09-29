import { Link, NavLink } from 'react-router-dom';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="TripVault home">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
        <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <rect x="3" y="7" width="18" height="13" rx="2.5" />
          <circle cx="12" cy="13.5" r="3.5" />
          <path d="M8.5 7l1.2-2.5h4.6L15.5 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {!compact && <span className="text-lg font-bold tracking-tight text-gray-900">TripVault</span>}
    </Link>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            My Trips
          </NavLink>
          <NavLink
            to="/trips/create"
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + New Trip
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
