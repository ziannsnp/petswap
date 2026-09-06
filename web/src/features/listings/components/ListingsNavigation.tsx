import { CalendarDays, Heart, Home, PawPrint, Search } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Search', Icon: Search },
  { to: '/bookings', label: 'Bookings', Icon: CalendarDays },
  { to: '/listings', label: 'My listings', Icon: Home },
  { to: '/pets', label: 'Pets', Icon: Heart },
];

export function ListingsNavigation() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:px-6 lg:gap-6 lg:px-8"
        aria-label="Primary navigation"
      >
        <Link
          className="flex shrink-0 items-center gap-2 font-bold text-brand-700"
          to="/"
          aria-label="PetSwap home"
        >
          <PawPrint className="h-7 w-7" aria-hidden="true" />
          <span className="hidden text-xl sm:inline">PetSwap</span>
        </Link>

        <div className="ml-auto flex h-full min-w-0 items-stretch">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-w-12 items-center justify-center gap-2 border-b-2 px-2 text-sm font-medium transition-colors lg:min-w-24 lg:px-3 ${
                  isActive
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-transparent text-gray-500 hover:bg-brand-50 hover:text-brand-700'
                }`
              }
              aria-label={label}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="hidden lg:inline">{label}</span>
            </NavLink>
          ))}
        </div>

        <Link
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700 sm:h-10 sm:w-10"
          to="/profile"
          aria-label="Open profile"
        >
          US
        </Link>
      </nav>
    </header>
  );
}
